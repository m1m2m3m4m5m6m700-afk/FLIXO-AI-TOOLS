import { applyBasicImageEffect, convertImage, flipImage, removeBackground, resizeImage, rotateImage } from '../tools/image-toolkit/engine';

export type ChainInput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ToolChainAdapter = (input: ChainInput) => Promise<ChainOutput>;
type ToolChainAdapterDefinition = Readonly<{ execute: ToolChainAdapter }>;
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'image-converter': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await convertImage(blob, 'image/webp'), fileName: baseName(fileName) + '.webp' }) }),
  'image-upscaler': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await resizeImage(blob, 2), fileName: baseName(fileName) + '-2x.png' }) }),
  'background-remover': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await removeBackground(blob, 42), fileName: baseName(fileName) + '-no-background.png' }) }),
  'image-rotate': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await rotateImage(blob, 90), fileName: baseName(fileName) + '-rotated.png' }) }),
  'image-flip-horizontal': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await flipImage(blob, true), fileName: baseName(fileName) + '-flipped-h.png' }) }),
  'image-flip-vertical': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await flipImage(blob, false), fileName: baseName(fileName) + '-flipped-v.png' }) }),
  'image-brightness': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'brightness', 115), fileName: baseName(fileName) + '-brightness.png' }) }),
  'image-contrast': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'contrast', 115), fileName: baseName(fileName) + '-contrast.png' }) }),
  'image-saturation': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'saturation', 115), fileName: baseName(fileName) + '-saturation.png' }) }),
  'image-grayscale': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'grayscale', 100), fileName: baseName(fileName) + '-grayscale.png' }) }),
  'image-invert': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'invert', 100), fileName: baseName(fileName) + '-invert.png' }) }),
  'image-sepia': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'sepia', 100), fileName: baseName(fileName) + '-sepia.png' }) }),
  'image-blur': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'blur', 80), fileName: baseName(fileName) + '-blur.png' }) }),
  'image-sharpen': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'sharpen', 110), fileName: baseName(fileName) + '-sharpen.png' }) }),
});

export const getToolChainAdapter = (toolId: string): ToolChainAdapter | undefined => TOOL_CHAIN_ADAPTERS[toolId]?.execute;

export async function executeToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    const definition = TOOL_CHAIN_ADAPTERS[toolId];
    if (!definition) throw new Error('Tool "' + toolId + '" has no local chain adapter yet.');
    onStep?.(index, steps.length, toolId);
    current = await definition.execute(current);
  }
  return current;
}
