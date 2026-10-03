import { convertImage, removeBackground, resizeImage } from '../tools/image-toolkit/engine';

export type ChainInput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ToolChainAdapter = (input: ChainInput) => Promise<ChainOutput>;
type ToolChainAdapterDefinition = Readonly<{ execute: ToolChainAdapter }>;
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'image-converter': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await convertImage(blob, 'image/webp'), fileName: baseName(fileName) + '.webp' }) }),
  'image-upscaler': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await resizeImage(blob, 2), fileName: baseName(fileName) + '-2x.png' }) }),
  'background-remover': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await removeBackground(blob, 42), fileName: baseName(fileName) + '-no-background.png' }) }),
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
