import type { VisualGoal } from './visual-goal';
import { getCapability } from './capability-registry';

export type VisualPlanStep = Readonly<{
  id: string;
  capabilityId: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
}>;

export type VisualEditPlan = Readonly<{
  id: string;
  goal: VisualGoal;
  steps: readonly VisualPlanStep[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const validateVisualEditPlan = (plan: VisualEditPlan): true => {
  if (!plan.id.trim()) throw new Error('VISUAL_PLAN_ID_REQUIRED');
  if (!plan.goal || !Array.isArray(plan.goal.target)) throw new Error('VISUAL_PLAN_GOAL_INVALID');
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) throw new Error('VISUAL_PLAN_STEPS_REQUIRED');
  const ids = new Set<string>();
  for (const step of plan.steps) {
    if (!step.id.trim() || ids.has(step.id)) throw new Error('VISUAL_PLAN_STEP_ID_INVALID');
    ids.add(step.id);
    if (!step.capabilityId.trim() || !isRecord(step.parameters)) throw new Error('VISUAL_PLAN_STEP_INVALID');
    const capability = getCapability(step.capabilityId);
    if (!capability) throw new Error('VISUAL_PLAN_CAPABILITY_UNKNOWN');
    if (capability.state !== 'EXECUTABLE') throw new Error('VISUAL_PLAN_CAPABILITY_NOT_EXECUTABLE');
  }
  return true;
};

// Advisory planner contract only. Execution remains owned by the canonical registry/execution gate.
