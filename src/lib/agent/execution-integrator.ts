import type { ExecutionPlan } from '@/lib/ai/planner';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { authorizeExecution } from './execution-gate';
import { getCapability } from './capability-registry';
import { createTaskContext, transitionTask, confirmTask, cancelTask, assertExecutionAllowed, type TaskContext } from './task-state';
import { getToolById } from '@/config/registry';
import { getToolOutputContractForDefinition } from '@/lib/contracts/tool-output-contracts';
import { getToolExecutor } from '@/lib/workflows/executor-registry';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';

export type PreparedExecution = Readonly<{ plan: ExecutionPlanContract; task: TaskContext }>;
export type ExecutionIntegrationResult = Readonly<{ output: Blob; task: TaskContext }>;

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
  return Object.freeze({ plan, task: awaitingConfirmation });
}

export function confirmPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  return Object.freeze({ ...prepared, task: confirmTask(prepared.task) });
}

export function cancelPreparedExecution(prepared: PreparedExecution): PreparedExecution {
  return Object.freeze({ ...prepared, task: cancelTask(prepared.task) });
}

export async function executePreparedExecution(
  prepared: PreparedExecution,
  inputFile: File,
  onProgress: (progress: PipelineProgress) => void,
): Promise<ExecutionIntegrationResult> {
  assertExecutionAllowed(prepared.task);
  if (inputFile.size <= 0) throw new Error('Execution is blocked because the input file is empty.');

  // Keep the canonical gate authoritative. The pipeline itself also performs per-step authorization.
  for (const step of prepared.plan.steps) {
    await authorizeExecution({
      task: prepared.task,
      capabilityId: step.toolId,
      parameters: step.params ?? {},
      inputBlob: inputFile,
    });
  }

  const output = await runWorkflowPipeline(inputFile, prepared.plan as ExecutionPlan, prepared.task, onProgress);
  const verifying = transitionTask(prepared.task, 'VERIFYING');
  const completed = transitionTask(verifying, 'COMPLETED');
  return Object.freeze({ output, task: completed });
}
