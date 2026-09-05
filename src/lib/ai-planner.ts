import type { QuickFlowPlan } from './quickflow.ts';

export type AiPlanner = (input: Readonly<{
  intent: string;
  deterministicPlan: QuickFlowPlan;
}>) => Promise<QuickFlowPlan | null>;

export type OptionalAiPlanInput = Readonly<{
  intent: string;
  deterministicPlan: QuickFlowPlan | null;
  planner?: AiPlanner;
  enabled?: boolean;
}>;

/**
 * AI is strictly an optional refinement layer. The deterministic plan is
 * always the fallback and remains the source of truth when AI is disabled,
 * unavailable, or returns an invalid/null result.
 */
export const buildOptionalAiPlan = async ({
  intent,
  deterministicPlan,
  planner,
  enabled = false,
}: OptionalAiPlanInput): Promise<QuickFlowPlan | null> => {
  if (!deterministicPlan) return null;
  if (!enabled || !planner) return deterministicPlan;

  try {
    const refined = await planner({ intent: intent.trim(), deterministicPlan });
    return refined ?? deterministicPlan;
  } catch {
    return deterministicPlan;
  }
};
