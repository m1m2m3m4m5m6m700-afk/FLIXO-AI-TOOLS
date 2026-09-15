import { assertExecutionResourceBudget, validateCapabilityParameters, getCapability } from './capability-registry.ts';
import { assertExecutionAllowed, type TaskContext } from './task-state.ts';

export type ExecutionGateInput = Readonly<{
  task: TaskContext;
  capabilityId: string;
  parameters?: unknown;
  inputBlob: Blob;
  requestedPixels?: number;
}>;

export type ExecutionGateResult = Readonly<{
  capabilityId: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
  executionMode: 'LOCAL' | 'HYBRID' | 'CLOUD';
  traceId: string;
}>;

/**
 * Single pre-execution boundary for the agent core.
 * It composes state, registry, parameter-schema, readiness, and resource checks
 * so callers do not need per-tool safety branches.
 */
export function authorizeExecution(input: ExecutionGateInput): ExecutionGateResult {
  assertExecutionAllowed(input.task);

  const capability = getCapability(input.capabilityId);
  if (!capability) throw new Error(`Unknown capability: ${input.capabilityId}`);

  const parameters = validateCapabilityParameters(input.capabilityId, input.parameters ?? {});
  assertExecutionResourceBudget(input.capabilityId, input.inputBlob, input.requestedPixels);

  return Object.freeze({
    capabilityId: input.capabilityId,
    parameters: Object.freeze({ ...parameters }),
    executionMode: capability.executionMode,
    traceId: input.task.traceId,
  });
}
