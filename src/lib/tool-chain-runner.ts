import { executeToolChain, type ChainInput, type ChainOutput } from './tool-chain-adapters';
import { validateToolChain } from './tool-chain-compatibility';

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  const validation = validateToolChain(steps, input);
  if (!validation.valid) throw new Error(validation.reason ?? 'Tool chain is not compatible.');

  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    onStep?.(index, steps.length, toolId);
    current = await executeToolChain([toolId], current);
  }
  onStep?.(steps.length, steps.length, steps[steps.length - 1]);
  return current;
}
