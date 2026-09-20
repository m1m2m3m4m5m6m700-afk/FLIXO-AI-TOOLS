import { assertExecutionResourceBudget, validateCapabilityParameters, getCapability } from './capability-registry.ts';
import { assertExecutionAllowed, type TaskContext } from './task-state.ts';
import { getToolDefinition } from '@/config/canonical-tool-definition.ts';
import { createExecutionAuditEvent, deriveRecoveryMetadata, deriveToolSecurityProfile, type ExecutionAuditEvent } from './execution-observability.ts';

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
  security: ReturnType<typeof deriveToolSecurityProfile>;
  recovery: ReturnType<typeof deriveRecoveryMetadata>;
  audit: ExecutionAuditEvent;
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
  const tool = getToolDefinition(input.capabilityId);
  if (!tool) throw new Error(`Unknown tool definition: ${input.capabilityId}`);
  const security = deriveToolSecurityProfile(tool);
  const recovery = deriveRecoveryMetadata(tool);
  const audit = createExecutionAuditEvent({ task: input.task, capabilityId: input.capabilityId, tool, stage: 'AUTHORIZATION', outcome: 'ALLOW' });

  return Object.freeze({
    capabilityId: input.capabilityId,
    parameters: Object.freeze({ ...parameters }),
    executionMode: capability.executionMode,
    traceId: input.task.traceId,
    security,
    recovery,
    audit,
  });
}
