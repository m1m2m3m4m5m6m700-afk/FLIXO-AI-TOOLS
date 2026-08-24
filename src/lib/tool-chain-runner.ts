import { executeToolChain, type ChainInput, type ChainOutput } from './tool-chain-adapters';

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  if (steps.length === 0) throw new Error('Tool chain is empty.');
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    onStep?.(index, steps.length, toolId);
    current = await executeToolChain([toolId], current);
  }
  onStep?.(steps.length, steps.length, steps[steps.length - 1]);
  return current;
}
