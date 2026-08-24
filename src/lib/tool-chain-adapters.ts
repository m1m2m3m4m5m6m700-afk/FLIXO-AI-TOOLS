import { convertImage, removeBackground, resizeImage } from '../tools/image-toolkit/engine';

export type ChainInput = Readonly<{
  blob: Blob;
  fileName: string;
}>;

export type ChainOutput = Readonly<{
  blob: Blob;
  fileName: string;
}>;

export type ToolChainAdapter = (input: ChainInput) => Promise<ChainOutput>;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapter>> = Object.freeze({
  'image-converter': async ({ blob, fileName }) => ({
    blob: await convertImage(blob, 'image/webp'),
    fileName: `${baseName(fileName)}.webp`,
  }),
  'image-upscaler': async ({ blob, fileName }) => ({
    blob: await resizeImage(blob, 2),
    fileName: `${baseName(fileName)}-2x.png`,
  }),
  'background-remover': async ({ blob, fileName }) => ({
    blob: await removeBackground(blob, 42),
    fileName: `${baseName(fileName)}-no-background.png`,
  }),
});

export const getToolChainAdapter = (toolId: string) => TOOL_CHAIN_ADAPTERS[toolId];

export async function executeToolChain(
  steps: readonly string[],
  input: ChainInput,
): Promise<ChainOutput> {
  let current = input;
  for (const toolId of steps) {
    const adapter = getToolChainAdapter(toolId);
    if (!adapter) throw new Error(`Tool "${toolId}" has no local chain adapter yet.`);
    current = await adapter(current);
  }
  return current;
}
