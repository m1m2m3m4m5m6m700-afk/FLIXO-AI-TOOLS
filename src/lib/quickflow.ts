import type { ToolConfig } from '../config/tools';
import { getBestToolIntent } from './intent-router.ts';

export type QuickFlowStep = Readonly<{
  toolId: string;
  path: string;
}>;

export type QuickFlowPlan = Readonly<{
  version: 1;
  intent: string;
  steps: readonly QuickFlowStep[];
}>;

const MAX_STEPS = 2;

export const buildQuickFlowPlan = (
  intent: string,
  tools: readonly ToolConfig[],
): QuickFlowPlan | null => {
  const normalizedIntent = intent.trim();
  if (!normalizedIntent) return null;

  const match = getBestToolIntent(normalizedIntent, tools);
  if (!match || match.score < 60) return null;

  const ready = tools.some((tool) => tool.isReady && tool.id === match.tool.id);
  if (!ready) return null;

  return {
    version: 1,
    intent: normalizedIntent,
    steps: [{ toolId: match.tool.id, path: match.tool.path }].slice(0, MAX_STEPS),
  };
};
