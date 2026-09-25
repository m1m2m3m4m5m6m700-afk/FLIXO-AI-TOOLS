import { assessAgentStuck, type AgentObservation } from './stuck-detector';

export type GoalCriterion = Readonly<{
  id: string;
  description: string;
}>;

export type GoalAssessment = Readonly<{
  satisfied: boolean;
  score: number;
  unmetCriteria: readonly string[];
  reason: string;
}>;

export type GoalControllerOptions = Readonly<{
  maxRefinements?: number;
}>;

export type GoalControllerResult<T> = Readonly<{
  status: 'SATISFIED' | 'REFINED' | 'BLOCKED';
  value: T;
  refinements: number;
  assessments: readonly GoalAssessment[];
  stuck: ReturnType<typeof assessAgentStuck>;
}>;

export type GoalJudge<T> = (value: T) => GoalAssessment;
export type GoalRefiner<T> = (value: T, assessment: GoalAssessment, refinementIndex: number) => T | null;

export const DEFAULT_MAX_REFINEMENTS = 2 as const;

export function runBoundedGoalLoop<T>(
  initialValue: T,
  judge: GoalJudge<T>,
  refine: GoalRefiner<T>,
  observations: readonly AgentObservation[] = [],
  options: GoalControllerOptions = {},
): GoalControllerResult<T> {
  const maxRefinements = Math.max(
    0,
    Math.min(3, Math.floor(options.maxRefinements ?? DEFAULT_MAX_REFINEMENTS)),
  );

  const assessments: GoalAssessment[] = [];
  let value = initialValue;
  const stuck = assessAgentStuck(observations);

  for (let refinementIndex = 0; refinementIndex <= maxRefinements; refinementIndex += 1) {
    const assessment = judge(value);
    if (!Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 1) {
      return Object.freeze({
        status: 'BLOCKED',
        value,
        refinements: refinementIndex,
        assessments: Object.freeze([...assessments, assessment]),
        stuck,
      });
    }

    assessments.push(assessment);
    if (assessment.satisfied) {
      return Object.freeze({
        status: refinementIndex === 0 ? 'SATISFIED' : 'REFINED',
        value,
        refinements: refinementIndex,
        assessments: Object.freeze([...assessments]),
        stuck,
      });
    }

    if (stuck.severity === 'STUCK' && stuck.recommendation !== 'CONTINUE') {
      return Object.freeze({
        status: 'BLOCKED',
        value,
        refinements: refinementIndex,
        assessments: Object.freeze([...assessments]),
        stuck,
      });
    }

    if (refinementIndex === maxRefinements) break;
    const next = refine(value, assessment, refinementIndex + 1);
    if (next === null || next === undefined) break;
    value = next;
  }

  return Object.freeze({
    status: 'BLOCKED',
    value,
    refinements: maxRefinements,
    assessments: Object.freeze([...assessments]),
    stuck,
  });
}
