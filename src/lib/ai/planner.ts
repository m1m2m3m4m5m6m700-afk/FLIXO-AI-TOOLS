import { resolveIntent } from '@/lib/intent/resolver';
import { parseExecutionPlan, MAX_PLAN_STEPS } from '@/lib/contracts/ai-plan';
import { buildIntentPlan } from '@/lib/agent/intent/intent-plan';
import type { ToolDefinition } from '@/config/canonical-tool-definition';
import { getCapability } from '@/lib/agent/capability-registry';
import { getWorkflow } from '@/lib/workflows/registry';

export type ExecutionPlan = {
  workflowName: string;
  confidence: number;
  steps: Array<{ toolId: ToolDefinition['id']; params?: Record<string, string | number | boolean | undefined> }>;
};

export const MAX_STEPS = MAX_PLAN_STEPS;

export function planFromWorkflow(workflowId: string): ExecutionPlan | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;
  const steps = workflow.steps.slice(0, MAX_STEPS).map((step) => ({ toolId: step.toolId, params: step.params }));
  if (!steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE')) return null;
  return validateExecutionPlan({ workflowName: workflow.title, confidence: 0.99, steps });
}

export function planFromIntent(input: string): ExecutionPlan | null {
  const intentPlan = buildIntentPlan(input);
  if (intentPlan.status !== 'READY') return null;
  return validateExecutionPlan({
    workflowName: intentPlan.steps.length > 1 ? 'Dynamic QuickFlow' : 'Direct Tool',
    confidence: Math.max(intentPlan.intent.confidence, 0.8),
    steps: intentPlan.steps,
  });
}

export function validateExecutionPlan(plan: unknown): ExecutionPlan {
  return parseExecutionPlan(plan) as ExecutionPlan;
}

export { buildIntentPlan } from '@/lib/agent/intent/intent-plan';
export { guardIntentPlan, guardExecutionSteps } from '@/lib/agent/intent/plan-guard';
