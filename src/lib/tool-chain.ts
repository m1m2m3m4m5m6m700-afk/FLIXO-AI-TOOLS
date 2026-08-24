const CHAIN_KEY = 'flixo:tool-chain:v1';
const MAX_CHAIN_LENGTH = 8;

export type ToolChainStep = Readonly<{
  id: string;
  order: number;
}>;

const normalize = (steps: unknown): ToolChainStep[] => {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step): step is { id: string; order: number } => Boolean(step) && typeof step === 'object' && typeof (step as { id?: unknown }).id === 'string')
    .slice(0, MAX_CHAIN_LENGTH)
    .map((step, index) => ({ id: step.id, order: index }));
};

export const getToolChain = (): ToolChainStep[] => {
  try {
    const raw = localStorage.getItem(CHAIN_KEY);
    return normalize(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

export const setToolChain = (ids: string[]) => {
  const unique = ids.filter((id, index) => typeof id === 'string' && ids.indexOf(id) === index).slice(0, MAX_CHAIN_LENGTH);
  const steps = unique.map((id, order) => ({ id, order }));
  try {
    localStorage.setItem(CHAIN_KEY, JSON.stringify(steps));
  } catch {
    // Local workspace persistence must never block tool usage.
  }
  return steps;
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
