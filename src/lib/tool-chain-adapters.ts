import { authorizeExecution } from './agent/execution-gate';
import type { TaskContext } from './agent/task-state';
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
type ToolChainAdapterDefinition = Readonly<{
  parameters: Readonly<Record<string, string | number | boolean>>;
  execute: ToolChainAdapter;
}>;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'image-converter': Object.freeze({
    parameters: Object.freeze({ format: 'image/webp' }),
    execute: async ({ blob, fileName }: ChainInput) => ({
      blob: await convertImage(blob, 'image/webp'),
      fileName: baseName(fileName) + '.webp',
    }),
  }),
  'image-upscaler': Object.freeze({
    parameters: Object.freeze({ scale: 2 }),
    execute: async ({ blob, fileName }: ChainInput) => ({
      blob: await resizeImage(blob, 2),
      fileName: baseName(fileName) + '-2x.png',
    }),
  }),
  'background-remover': Object.freeze({
    parameters: Object.freeze({ tolerance: 42 }),
    execute: async ({ blob, fileName }: ChainInput) => ({
      blob: await removeBackground(blob, 42),
      fileName: baseName(fileName) + '-no-background.png',
    }),
  }),
});

export const getToolChainAdapter = (toolId: string): ToolChainAdapter | undefined => TOOL_CHAIN_ADAPTERS[toolId]?.execute;

export async function executeToolChain(
  steps: readonly string[],
  input: ChainInput,
  task: TaskContext,
  onAuthorizedStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    const definition = TOOL_CHAIN_ADAPTERS[toolId];
    if (!definition) throw new Error('Tool "' + toolId + '" has no local chain adapter yet.');
    await authorizeExecution({
      task,
      capabilityId: toolId,
      parameters: definition.parameters,
      inputBlob: current.blob,
    });
    onAuthorizedStep?.(index, steps.length, toolId);
    current = await definition.execute(current);
  }
  return current;
}
