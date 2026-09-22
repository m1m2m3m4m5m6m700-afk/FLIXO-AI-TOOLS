import { resolveIntent } from '@/lib/intent/resolver';
import { parseExecutionPlan, MAX_PLAN_STEPS } from '@/lib/contracts/ai-plan';
import { buildQuickFlowPlan } from '@/lib/quickflow';
import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { getCapability } from '@/lib/agent/capability-registry';
import { TOOLS_REGISTRY } from '@/config/tools';
import { getWorkflow } from '@/lib/workflows/registry';

export type ExecutionPlan = ExecutionPlanContract;

export const MAX_STEPS = MAX_PLAN_STEPS;

export function planFromWorkflow(workflowId: string): ExecutionPlan | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;
  const steps = workflow.steps.slice(0, MAX_STEPS).map((step) => ({ toolId: step.toolId, params: step.params }));
  if (!steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE')) return null;
  return validateExecutionPlan({ workflowName: workflow.title, confidence: 0.99, steps });
}

export function planFromIntent(input: string): ExecutionPlan | null {
  const quickFlow = buildQuickFlowPlan(input, TOOLS_REGISTRY);
  if (quickFlow) {
    const intent = resolveIntent(input);
    const steps = quickFlow.steps.map((step) => ({ toolId: step.toolId as ExecutionPlan['steps'][number]['toolId'], params: step.params }));
    if (steps.length > MAX_STEPS || !steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE')) return null;
    if (intent.kind === 'tool' && intent.id && !steps.some((step) => step.toolId === intent.id)) return null;
    return validateExecutionPlan({
      workflowName: steps.length > 1 ? 'Dynamic QuickFlow' : 'Direct Tool',
      confidence: steps.length > 1 ? 0.95 : intent.confidence,
      steps,
    });
  }

  const intent = resolveIntent(input);
  if (intent.kind === 'workflow' && intent.id) return planFromWorkflow(intent.id);
  return null;
}

export function validateExecutionPlan(plan: unknown): ExecutionPlan { return parseExecutionPlan(plan) as ExecutionPlan; }
