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
import { appendConversationEvent } from './conversation-event-store';

export type PreparedExecution = Readonly<{ plan: ExecutionPlanContract; task: TaskContext }>;
export type ExecutionIntegrationResult = Readonly<{ output: Blob; task: TaskContext }>;

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

export function prepareExecution(planInput: unknown, identity: Readonly<{ taskId?: string; traceId?: string }> = {}): PreparedExecution {
  const plan = parseExecutionPlan(planInput);
  assertPlanGuard(plan);
  const base = createTaskContext(identity.taskId, identity.traceId);
  const planned = transitionTask(base, 'PLANNED');
  const awaitingConfirmation = transitionTask(planned, 'AWAITING_CONFIRMATION');
  void appendConversationEvent('PLAN_READY', {
    taskId: awaitingConfirmation.taskId,
    traceId: awaitingConfirmation.traceId,
    stepCount: plan.steps.length,
    toolIds: plan.steps.map((step) => step.toolId),
  });
  return Object.freeze({ plan, task: awaitingConfirmation });
}

export function confirmPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  const nextTask = confirmTask(prepared.task);
  void appendConversationEvent('TASK_STATE', { taskId: nextTask.taskId, traceId: nextTask.traceId, state: nextTask.state });
  return Object.freeze({ ...prepared, task: nextTask });
}

export function cancelPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  const nextTask = cancelTask(prepared.task);
  void appendConversationEvent('CANCELLED', { taskId: nextTask.taskId, traceId: nextTask.traceId });
  return Object.freeze({ ...prepared, task: nextTask });
}

export async function executePreparedExecution(
  prepared: PreparedExecution,
  inputFile: File,
  onProgress: (progress: PipelineProgress) => void,
): Promise<ExecutionIntegrationResult> {
  assertExecutionAllowed(prepared.task);
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

  try {
    const output = await runWorkflowPipeline(inputFile, prepared.plan as ExecutionPlan, prepared.task, onProgress);
    const verifying = transitionTask(prepared.task, 'VERIFYING');
    const completed = transitionTask(verifying, 'COMPLETED');
    void appendConversationEvent('EXECUTION_FINISHED', {
      taskId: completed.taskId,
      traceId: completed.traceId,
      toolIds: prepared.plan.steps.map((step) => step.toolId),
      state: completed.state,
    });
    return Object.freeze({ output, task: completed });
  } catch (cause) {
    let failedTask = prepared.task;
    if (failedTask.state === 'EXECUTING' || failedTask.state === 'VERIFYING' || failedTask.state === 'RECOVERING') {
      try { failedTask = transitionTask(failedTask, 'FAILED'); } catch { /* preserve original failure */ }
    }
    void appendConversationEvent('EXECUTION_FAILED', {
      taskId: failedTask.taskId,
      traceId: failedTask.traceId,
      toolId: prepared.plan.steps[0]?.toolId ?? null,
      errorClass: classifyExecutionFailure(cause),
      state: failedTask.state,
    });
    throw new ExecutionIntegrationError(
      cause instanceof Error ? cause.message : 'FLIXO execution failed.',
      { task: failedTask, cause, capabilityId: prepared.plan.steps[0]?.toolId },
    );
  }
}
