export type PlanStepBoundary = Readonly<{
  toolId: string;
  params?: Record<string, string | number | boolean | undefined>;
}>;

function normalizeParams(params: PlanStepBoundary['params']): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(params ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, value]),
  );
}

function normalizeSteps(plan: { steps: readonly PlanStepBoundary[] }): readonly unknown[] {
  return plan.steps.map((step) => ({
    toolId: step.toolId,
    params: normalizeParams(step.params),
  }));
}

/**
 * QuickFlow is the deterministic execution authority. AI may refine presentation,
 * confidence, or explanation, but it must never change the executable decision.
 */
export function isDeterministicPlanCompatible(
  candidate: { catalogFingerprint: string; steps: readonly PlanStepBoundary[] },
  deterministic: { catalogFingerprint: string; steps: readonly PlanStepBoundary[] } | null,
): boolean {
  if (!deterministic) return false;
  if (candidate.catalogFingerprint !== deterministic.catalogFingerprint) return false;
  return JSON.stringify(normalizeSteps(candidate)) === JSON.stringify(normalizeSteps(deterministic));
}
