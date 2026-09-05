export const EXECUTABLE_PIPELINE_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
] as const;

export type ExecutablePipelineToolId = (typeof EXECUTABLE_PIPELINE_TOOL_IDS)[number];
export const EXECUTABLE_PIPELINE_TOOL_ID_SET = new Set<string>(EXECUTABLE_PIPELINE_TOOL_IDS);
