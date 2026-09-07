import { planFromIntent, type ExecutionPlan } from './planner';

export type AIPlanProvider = (input: string) => Promise<unknown>;

export type OptionalPlanResult = {
  plan: ExecutionPlan | null;
  source: 'ai' | 'deterministic';
};

/**
 * AI is an enhancement, never a dependency. Any provider error or invalid
 * response falls back to the existing deterministic planner.
 */
export async function planWithOptionalAI(
  input: string,
  provider?: AIPlanProvider,
): Promise<OptionalPlanResult> {
  const deterministic = planFromIntent(input);
  if (!provider) return { plan: deterministic, source: 'deterministic' };

  try {
    const candidate = await provider(input);
    if (!candidate) return { plan: deterministic, source: 'deterministic' };
    const { validateExecutionPlan } = await import('./planner');
    const plan = validateExecutionPlan(candidate);
    return { plan, source: 'ai' };
  } catch {
    return { plan: deterministic, source: 'deterministic' };
  }
}
