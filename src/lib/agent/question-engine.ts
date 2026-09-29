import type { WorldModel } from './world-model.ts';

export type ClarificationRequirement = Readonly<{
  id: string;
  capability: string;
  kind: 'format' | 'crop-geometry' | 'operation' | 'clarification';
  question: string;
}>;

export type ClarificationScore = Readonly<{
  id: string;
  capability: string;
  kind: ClarificationRequirement['kind'];
  question: string;
  uncertaintyReduction: number;
  executionRiskReduction: number;
  userCost: number;
  impact: number;
  score: number;
}>;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function scoreRequirement(requirement: ClarificationRequirement, worldModel: WorldModel): ClarificationScore {
  const uncertaintyReduction = requirement.kind === 'operation' ? 1 : requirement.kind === 'crop-geometry' ? 0.85 : requirement.kind === 'format' ? 0.75 : 0.9;
  const executionRiskReduction = requirement.kind === 'operation' ? 1 : requirement.kind === 'crop-geometry' ? 0.85 : requirement.kind === 'format' ? 0.65 : 0.9;
  const impact = requirement.kind === 'operation' ? 1 : requirement.kind === 'crop-geometry' ? 0.9 : 0.75;
  const userCost = clamp(requirement.question.length / 2500);
  const score = clamp(
    0.35 * uncertaintyReduction
    + 0.35 * executionRiskReduction
    + 0.20 * impact
    - 0.10 * userCost
    + 0.05 * worldModel.ambiguityScore,
  );

  return Object.freeze({
    id: requirement.id,
    capability: requirement.capability,
    kind: requirement.kind,
    question: requirement.question,
    uncertaintyReduction,
    executionRiskReduction,
    userCost,
    impact,
    score,
  });
}

export function rankClarificationQuestions(
  requirements: readonly ClarificationRequirement[],
  worldModel: WorldModel,
): readonly ClarificationScore[] {
  return Object.freeze(
    requirements
      .map((requirement) => scoreRequirement(requirement, worldModel))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)),
  );
}

export function selectClarificationQuestion(
  requirements: readonly ClarificationRequirement[],
  worldModel: WorldModel,
): ClarificationScore | null {
  const [selected] = rankClarificationQuestions(requirements, worldModel);
  return selected ?? null;
}
