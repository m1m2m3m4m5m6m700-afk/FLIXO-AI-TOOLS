import type { ExecutionPlan } from '@/lib/ai/planner';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { authorizeExecution } from './execution-gate';
import { classifyExecutionFailure, deriveRecoveryMetadata } from './execution-observability';
import { getCapability } from './capability-registry';
import { createTaskContext, transitionTask, confirmTask, cancelTask, assertExecutionAllowed, type TaskContext } from './task-state';
import { getToolById } from '@/config/registry';
import { getToolOutputContractForDefinition } from '@/lib/contracts/tool-output-contracts';
import { getToolExecutor } from '@/lib/workflows/executor-registry';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import type { PipelineReceiptChain } from '@/lib/workflows/pipeline-receipt';
import { restoreFlixoBotRunState, type FlixoBotRunState } from './flixo-bot-openai-runtime';
import {
  afterRuntimeTool,
  beforeRuntimeTool,
  cancelRuntimeExecution,
  completeRuntimeExecution,
  confirmRuntimeExecution,
  failRuntimeExecution,
  runtimeStatusToTaskState,
} from './flixo-bot-task-bridge';
import { requireFlixoBuildSha } from './build-identity';
import { appendConversationEvent } from './conversation-event-store';

export type PreparedExecution = Readonly<{ plan: ExecutionPlanContract; task: TaskContext; runtimeState?: FlixoBotRunState }>;
export type ExecutionIntegrationResult = Readonly<{ output: Blob; task: TaskContext; runtimeState?: FlixoBotRunState; receiptChain?: PipelineReceiptChain }>;

export class ExecutionIntegrationError extends Error {
  readonly task: TaskContext;
  readonly errorClass: ReturnType<typeof classifyExecutionFailure>;
  readonly capabilityId: string | undefined;
  readonly recovery: ReturnType<typeof deriveRecoveryMetadata> | undefined;

  constructor(message: string, options: Readonly<{ task: TaskContext; cause?: unknown; capabilityId?: string }>) {
    super(message);
    this.name = 'ExecutionIntegrationError';
    this.task = options.task;
    this.errorClass = classifyExecutionFailure(options.cause ?? message);
    this.capabilityId = options.capabilityId;
    const tool = options.capabilityId ? getToolById(options.capabilityId) : undefined;
    this.recovery = tool ? deriveRecoveryMetadata(tool) : undefined;
  }
}

function assertPlanGuard(plan: ExecutionPlanContract): void {
  if (plan.steps.length < 1 || plan.steps.length > 4) {
    throw new Error('FLIXO execution plans must contain 1 to 4 steps.');
  }
  for (const step of plan.steps) {
    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      throw new Error('Execution plan references a non-executable capability: ' + step.toolId);
    }
    const tool = getToolById(step.toolId);
    if (!tool) throw new Error('Canonical tool definition is missing: ' + step.toolId);
    if (!getToolExecutor(tool)) throw new Error('Existing executor is unavailable: ' + step.toolId);
    if (!getToolOutputContractForDefinition(tool)) {
      throw new Error('Verification output contract is missing: ' + step.toolId);
    }
  }
}

export function prepareExecution(
  planInput: unknown,
  identity: Readonly<{ taskId?: string; traceId?: string; runtimeState?: FlixoBotRunState }> = {},
): PreparedExecution {
  const plan = parseExecutionPlan(planInput);
  assertPlanGuard(plan);
  const base = createTaskContext(identity.taskId, identity.traceId);
  const planned = transitionTask(base, 'PLANNED');
  const awaitingConfirmation = transitionTask(planned, 'AWAITING_CONFIRMATION');
  if (identity.runtimeState) {
    if (identity.runtimeState.taskId !== awaitingConfirmation.taskId) throw new Error('FLIXO_BOT_RUNTIME_TASK_ID_MISMATCH');
    if (identity.runtimeState.traceId !== awaitingConfirmation.traceId) throw new Error('FLIXO_BOT_RUNTIME_TRACE_ID_MISMATCH');
    if (identity.runtimeState.status !== 'WAITING_APPROVAL') throw new Error('FLIXO_BOT_RUNTIME_PLAN_NOT_AWAITING_APPROVAL');
  }
  void appendConversationEvent('PLAN_READY', {
    taskId: awaitingConfirmation.taskId,
    traceId: awaitingConfirmation.traceId,
    stepCount: plan.steps.length,
    toolIds: plan.steps.map((step) => step.toolId),
  });
  return Object.freeze({ plan, task: awaitingConfirmation, ...(identity.runtimeState ? { runtimeState: identity.runtimeState } : {}) });
}

export function restorePreparedExecution(
  planInput: unknown,
  runtimeResumeState: string,
): PreparedExecution {
  const plan = parseExecutionPlan(planInput);
  assertPlanGuard(plan);
  const runtimeState = restoreFlixoBotRunState(runtimeResumeState, requireFlixoBuildSha());
  if (runtimeState.status !== 'WAITING_APPROVAL') {
    throw new Error('FLIXO_BOT_RUNTIME_RESUME_NOT_APPROVAL_READY');
  }
  const base = createTaskContext(runtimeState.taskId, runtimeState.traceId);
  const planned = transitionTask(base, 'PLANNED');
  const awaitingConfirmation = transitionTask(planned, 'AWAITING_CONFIRMATION');
  if (runtimeStatusToTaskState(runtimeState.status) !== awaitingConfirmation.state) {
    throw new Error('FLIXO_BOT_RUNTIME_RESUME_TASK_STATE_MISMATCH');
  }
  return Object.freeze({ plan, task: awaitingConfirmation, runtimeState });
}

export function confirmPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  const nextTask = confirmTask(prepared.task);
  const nextRuntime = prepared.runtimeState
    ? confirmRuntimeExecution(prepared.runtimeState, nextTask)
    : null;
  void appendConversationEvent('TASK_STATE', {
    taskId: nextTask.taskId,
    traceId: nextTask.traceId,
    state: nextTask.state,
    runtimeStatus: nextRuntime?.runtime.status ?? null,
  });
  return Object.freeze({
    ...prepared,
    task: nextTask,
    ...(nextRuntime ? { runtimeState: nextRuntime.runtime } : {}),
  });
}

export function cancelPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  const nextTask = cancelTask(prepared.task);
  const nextRuntime = prepared.runtimeState && !['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'].includes(prepared.runtimeState.status)
    ? cancelRuntimeExecution(prepared.runtimeState, prepared.task, 'USER_CANCELLED')
    : null;
  void appendConversationEvent('CANCELLED', {
    taskId: nextTask.taskId,
    traceId: nextTask.traceId,
    runtimeStatus: nextRuntime?.status ?? null,
  });
  return Object.freeze({
    ...prepared,
    task: nextTask,
    ...(nextRuntime ? { runtimeState: nextRuntime } : {}),
  });
}

export async function executePreparedExecution(
  prepared: PreparedExecution,
  inputFile: File,
  onProgress: (progress: PipelineProgress) => void,
): Promise<ExecutionIntegrationResult> {
  assertExecutionAllowed(prepared.task);
  let runtimeState = prepared.runtimeState;
  if (runtimeState && runtimeState.status !== 'RUNNING') {
    throw new Error('FLIXO_BOT_RUNTIME_EXECUTION_NOT_STARTED');
  }
  void appendConversationEvent('EXECUTION_STARTED', {
    taskId: prepared.task.taskId,
    traceId: prepared.task.traceId,
    toolIds: prepared.plan.steps.map((step) => step.toolId),
  });
  if (inputFile.size <= 0) throw new Error('Execution is blocked because the input file is empty.');

  // Keep the canonical gate authoritative. The pipeline itself also performs per-step authorization.
  const firstStep = prepared.plan.steps[0];
  if (firstStep) {
    await authorizeExecution({
      task: prepared.task,
      capabilityId: firstStep.toolId,
      parameters: firstStep.params ?? {},
      inputBlob: inputFile,
    });
  }

  let latestReceiptChain: PipelineReceiptChain | undefined;
  const runtimeAwareProgress = (progress: PipelineProgress): void => {
    latestReceiptChain = progress.receiptChain ?? latestReceiptChain;
    onProgress(progress);
  };
  const runtimeHooks = runtimeState
    ? {
      beforeTool: async ({ toolId, stepIndex, attempt }: { toolId: string; stepIndex: number; attempt: number }) => {
        runtimeState = beforeRuntimeTool(
          runtimeState!,
          prepared.task,
          toolId,
          `tool:${stepIndex}:${attempt}:${toolId}`,
          attempt,
        );
      },
      afterTool: async ({ toolId, stepIndex, attempt, success, outputBlob, receipt, receiptChain }: {
        toolId: string;
        stepIndex: number;
        attempt: number;
        success: boolean;
        outputBlob: Blob;
        receipt?: PipelineProgress['receipt'];
        receiptChain: PipelineReceiptChain;
      }) => {
        latestReceiptChain = receiptChain;
        runtimeState = afterRuntimeTool(
          runtimeState!,
          prepared.task,
          toolId,
          success,
          { byteLength: outputBlob.size, mimeType: outputBlob.type },
          receipt ? {
            inputSha256: receipt.inputSha256,
            outputSha256: receipt.outputSha256,
            verified: receipt.verified,
            executorId: receipt.executorId,
            executionMode: receipt.executionMode,
            attempt: receipt.attempt,
            receiptChainSha256: receiptChain.chainSha256,
          } : undefined,
        );
      },
    }
    : undefined;

  try {
    const output = await runWorkflowPipeline(
      inputFile,
      prepared.plan as ExecutionPlan,
      prepared.task,
      runtimeAwareProgress,
      runtimeHooks,
    );
    const verifying = transitionTask(prepared.task, 'VERIFYING');
    const completed = transitionTask(verifying, 'COMPLETED');
    if (runtimeState) {
      runtimeState = completeRuntimeExecution(runtimeState, completed, {
        byteLength: output.size,
        mimeType: output.type,
      });
    }
    void appendConversationEvent('EXECUTION_FINISHED', {
      taskId: completed.taskId,
      traceId: completed.traceId,
      toolIds: prepared.plan.steps.map((step) => step.toolId),
      state: completed.state,
      runtimeStatus: runtimeState?.status ?? null,
      receiptChainSha256: latestReceiptChain?.chainSha256 ?? null,
    });
    return Object.freeze({
      output,
      task: completed,
      ...(runtimeState ? { runtimeState } : {}),
      ...(latestReceiptChain ? { receiptChain: latestReceiptChain } : {}),
    });
  } catch (cause) {
    let failedTask = prepared.task;
    if (runtimeState && !['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'].includes(runtimeState.status)) {
      runtimeState = failRuntimeExecution(
        runtimeState,
        prepared.task,
        cause instanceof Error ? cause.message : 'FLIXO_EXECUTION_FAILED',
      );
    }
    if (failedTask.state === 'EXECUTING' || failedTask.state === 'VERIFYING' || failedTask.state === 'RECOVERING') {
      try { failedTask = transitionTask(failedTask, 'FAILED'); } catch { /* preserve original failure */ }
    }
    void appendConversationEvent('EXECUTION_FAILED', {
      taskId: failedTask.taskId,
      traceId: failedTask.traceId,
      toolId: prepared.plan.steps[0]?.toolId ?? null,
      errorClass: classifyExecutionFailure(cause),
      state: failedTask.state,
      runtimeStatus: runtimeState?.status ?? null,
      receiptChainSha256: latestReceiptChain?.chainSha256 ?? null,
    });
    throw new ExecutionIntegrationError(
      cause instanceof Error ? cause.message : 'FLIXO execution failed.',
      { task: failedTask, cause, capabilityId: prepared.plan.steps[0]?.toolId },
    );
  }
}
