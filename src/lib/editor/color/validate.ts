import type { ColorPipeline } from './types';

export const validateColorPipeline = (pipeline: ColorPipeline): true => {
  if (pipeline.bitDepth !== 8 && pipeline.bitDepth !== 16) throw new Error('COLOR_BIT_DEPTH_INVALID');
  if (!['srgb', 'display-p3', 'adobe-rgb'].includes(pipeline.input)) throw new Error('COLOR_INPUT_SPACE_INVALID');
  if (!['srgb', 'display-p3', 'adobe-rgb'].includes(pipeline.working)) throw new Error('COLOR_WORKING_SPACE_INVALID');
  if (!['srgb', 'display-p3', 'adobe-rgb'].includes(pipeline.output)) throw new Error('COLOR_OUTPUT_SPACE_INVALID');
  return true;
};
