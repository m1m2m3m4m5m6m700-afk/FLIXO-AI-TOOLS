import type { ToolDefinition } from '../config/canonical-tool-definition';
import { getBestToolIntent } from './intent-router.ts';
export type QuickFlowStep = Readonly<{ toolId: string; path: string; params?: Record<string, string | number | boolean> }>;
export type QuickFlowPlan = Readonly<{ version: 2; intent: string; steps: readonly QuickFlowStep[] }>;
export const buildQuickFlowPlan = (intent: string, tools: readonly ToolDefinition[]): QuickFlowPlan | null => {
  const normalized = intent.trim();
  if (!normalized) return null;
  const match = getBestToolIntent(normalized, tools);
  if (!match || match.score < 60 || !match.tool.isReady) return null;
  return { version: 2, intent: normalized, steps: [{ toolId: match.tool.id, path: match.tool.path }] };
};
