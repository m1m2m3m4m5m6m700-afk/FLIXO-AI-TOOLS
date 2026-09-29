export type VisualGoal = Readonly<{
  target: string;
  desiredChanges: readonly string[];
  protectedRegions: readonly string[];
  constraints: readonly string[];
  qualityRequirements: readonly string[];
  acceptanceCriteria: readonly string[];
}>;

const strings = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);

export const validateVisualGoal = (goal: VisualGoal): true => {
  if (!goal || typeof goal.target !== 'string' || !goal.target.trim()) throw new Error('VISUAL_GOAL_TARGET_REQUIRED');
  for (const key of ['desiredChanges','protectedRegions','constraints','qualityRequirements','acceptanceCriteria'] as const) {
    if (!strings(goal[key])) throw new Error('VISUAL_GOAL_FIELDS_INVALID');
  }
  if (goal.acceptanceCriteria.length === 0) throw new Error('VISUAL_GOAL_ACCEPTANCE_REQUIRED');
  return true;
};
