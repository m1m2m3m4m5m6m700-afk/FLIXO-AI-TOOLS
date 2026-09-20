import { createTaskContext, transitionTask, type TaskContext } from './agent/task-state';
import { executeToolChain, getToolChainAdapter, type ChainInput, type ChainOutput } from './tool-chain-adapters';
import { validateToolChain } from './tool-chain-compatibility';

const createConfirmedChainTask = (): TaskContext => {
  let task = createTaskContext();
  task = transitionTask(task, 'PLANNED');
  task = transitionTask(task, 'AWAITING_CONFIRMATION');
  return transitionTask(task, 'EXECUTING');
};

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  const validation = validateToolChain(steps, input);
  if (!validation.valid) throw new Error(validation.reason ?? 'Tool chain is not compatible.');

  for (const toolId of steps) {
    if (!getToolChainAdapter(toolId)) {
      throw new Error('Tool "' + toolId + '" has no local chain adapter.');
    }
  }

  const task = createConfirmedChainTask();
  return executeToolChain(steps, input, task, onStep);
}
