import { planFromIntent, type ExecutionPlan } from './planner';
import { planWithProviderOrLocal, type LLMProvider } from '@/lib/agent/llm-provider';

export type AIPlanProvider = (input: string) => Promise<unknown>;

export type OptionalPlanResult = {
  plan: ExecutionPlan | null;
  source: 'ai' | 'deterministic';
};

export type ProductionAIPlanResult = OptionalPlanResult & {
  latencyMs: number;
  attempts: number;
  model?: string;
  usage?: ReturnType<typeof planWithProviderOrLocal> extends Promise<infer T> ? T extends { usage?: infer U } ? U : never : never;
  providerFailure?: Error;
};

/**
 * Legacy optional AI adapter. AI is an enhancement, never a dependency.
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

/**
 * Production LLM integration point. The provider only proposes a plan;
 * canonical capability validation and deterministic fallback remain authoritative.
 */
export async function planWithProductionAI(
  input: string,
  provider?: LLMProvider,
  options: {
    timeoutMs?: number;
    maxTokens?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    maxRetryDelayMs?: number;
  } = {},
): Promise<ProductionAIPlanResult> {
  const result = await planWithProviderOrLocal(provider, input, options);
  return Object.freeze({
    plan: result.plan as ExecutionPlan | null,
    source: result.source === 'provider' ? 'ai' : 'deterministic',
    latencyMs: result.latencyMs,
    attempts: result.attempts,
    model: result.model,
    usage: result.usage,
    providerFailure: result.providerFailure,
  });
}
