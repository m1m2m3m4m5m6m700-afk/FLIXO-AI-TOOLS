import { getExecutableCapabilityIds } from '@/lib/agent/capability-registry';

export const EXECUTABLE_PIPELINE_TOOL_IDS: readonly string[] = Object.freeze(getExecutableCapabilityIds());
export type ExecutablePipelineToolId = string;
export const EXECUTABLE_PIPELINE_TOOL_ID_SET = new Set<string>(EXECUTABLE_PIPELINE_TOOL_IDS);
