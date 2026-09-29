import type { EvaluationResult } from './visual-evaluator';

export type RefinementBudget = Readonly<{
  maxAttempts: number;
  maxMutations: number;
  maxMilliseconds: number;
}>;

export type RefinementStep = Readonly<{
  attempt: number;
  planId: string;
  evaluation: EvaluationResult;
}>;

export const runBoundedRefinement = (
  steps: readonly RefinementStep[],
  budget: RefinementBudget,
): RefinementStep | null => {
  if (budget.maxAttempts < 1 || budget.maxMutations < 0 || budget.maxMilliseconds < 1) {
    throw new Error('REFINEMENT_BUDGET_INVALID');
  }
  const accepted = steps.find((step) => step.evaluation.artifactValid &&
    step.evaluation.structureValid && step.evaluation.pixelValid && step.evaluation.goalSatisfied);
  if (accepted) return accepted;
  if (steps.length >= budget.maxAttempts || steps.length >= budget.maxMutations) return null;
  return null;
};
