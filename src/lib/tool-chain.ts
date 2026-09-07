import { parseToolChain } from './runtime-boundaries.ts';

const CHAIN_KEY = 'flixo:tool-chain:v1';
const MAX_CHAIN_LENGTH = 8;

type ToolChainStep = Readonly<{
  id: string;
  order: number;
}>;

function readStoredChain(): ToolChainStep[] {
  const raw = localStorage.getItem(CHAIN_KEY);
  if (raw === null) return [];

  try {
    return parseToolChain(JSON.parse(raw));
  } catch (error) {
    localStorage.removeItem(CHAIN_KEY);
    console.error('[FLIXO][boundary] Purged invalid tool-chain persistence.', { key: CHAIN_KEY, error });
    return [];
  }
}

export const getToolChain = (): ToolChainStep[] => readStoredChain();

export const setToolChain = (ids: string[]) => {
  const unique = Array.from(new Set(ids)).slice(0, MAX_CHAIN_LENGTH);
  try {
    const steps = parseToolChain(unique.map((id, order) => ({ id, order })));
    localStorage.setItem(CHAIN_KEY, JSON.stringify(steps));
    return steps;
  } catch (error) {
    console.error('[FLIXO][boundary] Refused invalid tool-chain write.', { key: CHAIN_KEY, error });
    return readStoredChain();
  }
};

export const addToolToChain = (toolId: string) => setToolChain([...getToolChain().map((step) => step.id), toolId]);
export const removeToolFromChain = (toolId: string) => setToolChain(getToolChain().map((step) => step.id).filter((id) => id !== toolId));
export const moveToolInChain = (toolId: string, direction: -1 | 1) => {
  const ids = getToolChain().map((step) => step.id);
  const index = ids.indexOf(toolId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return getToolChain();
  [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
  return setToolChain(ids);
};
export const clearToolChain = () => setToolChain([]);
