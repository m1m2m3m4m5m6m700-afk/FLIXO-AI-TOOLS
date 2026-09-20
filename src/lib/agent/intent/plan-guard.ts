import { safeParseExecutionPlan } from '@/lib/contracts/ai-plan';
import type { IntentExecutionStep, IntentPlan } from '@/lib/agent/intent/intent-plan';

export type PlanGuardResult =
  | Readonly<{ ok: true; execution: { workflowName: string; confidence: number; steps: IntentExecutionStep[] } }>
  | Readonly<{ ok: false; reason: string }>;

export function guardExecutionSteps(
  workflowName: string,
  confidence: number,
  steps: readonly IntentExecutionStep[],
): PlanGuardResult {
  const candidate = {
    workflowName,
    confidence,
    steps: steps.map((step) => ({ toolId: step.toolId, params: step.params })),
  };
  const parsed = safeParseExecutionPlan(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues.map((issue) => issue.message).join('; '),
    };
  }

  const seen = new Set<string>();
  for (const step of parsed.data.steps) {
    if (seen.has(step.toolId)) return { ok: false, reason: 'Duplicate capability in plan: ' + step.toolId + '.' };
    seen.add(step.toolId);
  }

  return { ok: true, execution: parsed.data };
}

export function guardIntentPlan(plan: IntentPlan): PlanGuardResult {
  if (plan.status !== 'READY') return { ok: false, reason: 'Plan is not executable: ' + plan.status + '.' };
  if (!plan.confirmationRequired) return { ok: false, reason: 'Executable plans require explicit confirmation.' };
  return guardExecutionSteps(
    plan.steps.length > 1 ? 'FLIXO QuickFlow' : 'FLIXO Direct Tool',
    plan.intent.confidence,
    plan.steps,
  );
}
