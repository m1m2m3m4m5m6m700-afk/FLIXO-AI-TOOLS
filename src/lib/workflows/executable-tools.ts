import { CAPABILITY_REGISTRY } from '@/lib/agent/capability-registry';

export const EXECUTABLE_PIPELINE_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
] as const;

const registryExecutableIds = CAPABILITY_REGISTRY
  .filter((capability) => capability.state === 'EXECUTABLE')
  .map((capability) => capability.id)
  .sort();

const declaredExecutableIds = [...EXECUTABLE_PIPELINE_TOOL_IDS].sort();
if (JSON.stringify(registryExecutableIds) !== JSON.stringify(declaredExecutableIds)) {
  throw new Error('Capability registry executable set drift detected.');
}

export type ExecutablePipelineToolId = (typeof EXECUTABLE_PIPELINE_TOOL_IDS)[number];
export const EXECUTABLE_PIPELINE_TOOL_ID_SET = new Set<string>(EXECUTABLE_PIPELINE_TOOL_IDS);
