import { CAPABILITY_REGISTRY } from '@/lib/agent/capability-registry';

const executableIds = CAPABILITY_REGISTRY
  .filter((capability) => capability.state === 'EXECUTABLE')
  .map((capability) => capability.id);

export const EXECUTABLE_PIPELINE_TOOL_IDS = executableIds as readonly [
  string,
  ...string[],
];

export type ExecutablePipelineToolId = (typeof EXECUTABLE_PIPELINE_TOOL_IDS)[number];
export const EXECUTABLE_PIPELINE_TOOL_ID_SET = new Set<string>(EXECUTABLE_PIPELINE_TOOL_IDS);
