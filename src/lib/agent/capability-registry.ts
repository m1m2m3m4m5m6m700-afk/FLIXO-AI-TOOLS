import type { ZodType } from 'zod';
import { TOOL_DEFINITIONS } from '@/config/canonical-tool-definition';

export type CapabilityState = 'RECOGNIZED' | 'PLANNABLE' | 'EXECUTABLE' | 'UNAVAILABLE';
export type ExecutionMode = 'LOCAL' | 'HYBRID' | 'CLOUD';
export type CapabilityParameters = Record<string, string | number | boolean>;
export type CapabilityVerifier = (inputBlob: Blob, outputBlob: Blob, parameters: CapabilityParameters) => Promise<boolean>;
export type CapabilityLimits = Readonly<{ maxPixels: number; maxFileSizeBytes: number; timeoutMs: number }>;
export type CapabilityContract = Readonly<{
  id: string;
  state: CapabilityState;
  executionMode: ExecutionMode;
  intents: readonly string[];
  parameterSchema: ZodType;
  safetyLimits: CapabilityLimits;
  verifier: CapabilityVerifier;
}>;

export const CAPABILITY_REGISTRY: readonly CapabilityContract[] = Object.freeze(
  TOOL_DEFINITIONS.map((tool) => ({
    id: tool.id,
    state: tool.capability.state,
    executionMode: tool.executionMode,
    intents: tool.capability.intents,
    parameterSchema: tool.parameterSchema,
    safetyLimits: tool.safetyLimits,
    verifier: tool.verifier,
  })),
);

const byId = new Map(CAPABILITY_REGISTRY.map((capability) => [capability.id, capability]));
export function getCapability(id: string): CapabilityContract | undefined { return byId.get(id); }
export function getCapabilitiesByState(state: CapabilityState): readonly CapabilityContract[] {
  return CAPABILITY_REGISTRY.filter((capability) => capability.state === state);
}
export function getExecutableCapabilityIds(): readonly string[] {
  return CAPABILITY_REGISTRY.filter((capability) => capability.state === 'EXECUTABLE').map((capability) => capability.id);
}
export function validateCapabilityParameters(id: string, parameters: unknown = {}): CapabilityParameters {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== 'EXECUTABLE') throw new Error(`Capability '${id}' is not executable.`);
  return capability.parameterSchema.parse(parameters) as CapabilityParameters;
}
export function assertExecutionResourceBudget(id: string, inputBlob: Blob, requestedPixels?: number): void {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== 'EXECUTABLE') throw new Error(`Capability '${id}' is not executable.`);
  if (inputBlob.size > capability.safetyLimits.maxFileSizeBytes) throw new Error(`Capability '${id}' input exceeds the safe file-size limit.`);
  if (requestedPixels !== undefined && requestedPixels > capability.safetyLimits.maxPixels) throw new Error(`Capability '${id}' request exceeds the safe pixel limit.`);
}
