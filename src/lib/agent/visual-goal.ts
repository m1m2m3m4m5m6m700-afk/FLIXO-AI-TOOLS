export type VisualGoal = Readonly<{
  target: string;
  desiredChanges: readonly string[];
  protectedRegions: readonly string[];
  constraints: readonly string[];
  qualityRequirements: readonly string[];
  acceptanceCriteria: readonly string[];
}>;

export const validateVisualGoal = (goal: VisualGoal): true => {
  if (!goal.target.trim()) throw new Error('VISUAL_GOAL_TARGET_REQUIRED');
  if (goal.acceptanceCriteria.length === 0) throw new Error('VISUAL_GOAL_ACCEPTANCE_REQUIRED');
  return true;
};
