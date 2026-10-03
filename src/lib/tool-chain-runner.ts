import { executeToolChain, getToolChainAdapter, type ChainInput, type ChainOutput } from './tool-chain-adapters';
import { validateToolChain } from './tool-chain-compatibility';

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  const validation = validateToolChain(steps, input);
  if (!validation.valid) throw new Error(validation.reason ?? 'Tool chain is not compatible.');
  for (const toolId of steps) {
    if (!getToolChainAdapter(toolId)) throw new Error('Tool "' + toolId + '" has no local chain adapter.');
  }
  return executeToolChain(steps, input, onStep);
}
