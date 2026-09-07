import { z } from 'zod';
import { TOOLS_REGISTRY } from '@/config/tools';

const CHAIN_KEY = 'flixo:tool-chain:v1';
const MAX_CHAIN_LENGTH = 8;

export type ToolChainStep = Readonly<{ id: string; order: number }>;
const persistedStepSchema = z.object({ id: z.string().min(1).max(128), order: z.number().int().nonnegative() }).strict();
const persistedChainSchema = z.array(persistedStepSchema).max(MAX_CHAIN_LENGTH);
const readyToolIds = new Set(TOOLS_REGISTRY.filter((tool) => tool.isReady).map((tool) => tool.id));

function purgeCorruptState(reason: unknown): ToolChainStep[] {
  console.error('[tool-chain] rejected persisted state', reason);
  try { localStorage.removeItem(CHAIN_KEY); } catch { /* storage may be unavailable */ }
  return [];
}

const normalize = (value: unknown): ToolChainStep[] => {
  const parsed = persistedChainSchema.safeParse(value);
  if (!parsed.success) return purgeCorruptState(parsed.error.flatten());
  const invalidIds = parsed.data.filter((step) => !readyToolIds.has(step.id));
  if (invalidIds.length) return purgeCorruptState({ invalidToolIds: invalidIds.map((step) => step.id) });
  return parsed.data
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ id: step.id, order: index }));
};

export const getToolChain = (): ToolChainStep[] => {
  try {
    const raw = localStorage.getItem(CHAIN_KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch (error) {
    return purgeCorruptState(error);
  }
};

export const setToolChain = (ids: string[]) => {
  const unique = ids.filter((id, index) => typeof id === 'string' && readyToolIds.has(id) && ids.indexOf(id) === index).slice(0, MAX_CHAIN_LENGTH);
  const steps = unique.map((id, order) => ({ id, order }));
  try { localStorage.setItem(CHAIN_KEY, JSON.stringify(steps)); } catch { /* Local persistence must not block tool usage. */ }
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
