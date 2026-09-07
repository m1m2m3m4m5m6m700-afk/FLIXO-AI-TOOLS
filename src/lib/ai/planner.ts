import { resolveIntent } from '@/lib/intent/resolver';
import { EXECUTABLE_PIPELINE_TOOL_ID_SET } from '@/lib/workflows/executable-tools';
import { parseExecutionPlan, MAX_PLAN_STEPS } from '@/lib/contracts/ai-plan';
import type { ToolConfig } from '@/config/tools';
import { getWorkflow } from '@/lib/workflows/registry';
import type { QuickFlowPlan } from '../quickflow.ts';

export type ExecutionPlan = {
  workflowName: string;
  confidence: number;
  steps: Array<{ toolId: ToolConfig['id']; params?: Record<string, string | number | boolean | undefined> }>;
};

export type AiPlanner = (input: Readonly<{
  intent: string;
  deterministicPlan: QuickFlowPlan;
}>) => Promise<QuickFlowPlan | null>;

export type OptionalAiPlanInput = Readonly<{
  intent: string;
  deterministicPlan: QuickFlowPlan | null;
  planner?: AiPlanner;
  enabled?: boolean;
}>;

export type AIPlanProvider = (input: string) => Promise<unknown>;

export type OptionalPlanResult = {
  plan: ExecutionPlan | null;
  source: 'ai' | 'deterministic';
};

export const MAX_STEPS = MAX_PLAN_STEPS;

export function planFromWorkflow(workflowId: string): ExecutionPlan | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;
  const steps = workflow.steps.slice(0, MAX_STEPS).map((step) => ({ toolId: step.toolId, params: step.params }));
  if (!steps.every((step) => EXECUTABLE_PIPELINE_TOOL_ID_SET.has(step.toolId))) return null;
  return validateExecutionPlan({ workflowName: workflow.title, confidence: 0.99, steps });
}

export function planFromIntent(input: string): ExecutionPlan | null {
  const intent = resolveIntent(input);
  if (intent.kind === 'workflow' && intent.id) return planFromWorkflow(intent.id);
  if (intent.kind === 'tool' && intent.id && EXECUTABLE_PIPELINE_TOOL_ID_SET.has(intent.id)) {
    return validateExecutionPlan({ workflowName: 'Direct Tool', confidence: intent.confidence, steps: [{ toolId: intent.id }] });
  }
  return null;
}

export function validateExecutionPlan(plan: unknown): ExecutionPlan {
  return parseExecutionPlan(plan) as ExecutionPlan;
}

/**
 * AI is strictly an optional refinement layer. The deterministic plan is
 * always the fallback and remains the source of truth when AI is disabled,
 * unavailable, or returns an invalid/null result.
 */
export const buildOptionalAiPlan = async ({
  intent,
  deterministicPlan,
  planner,
  enabled = false,
}: OptionalAiPlanInput): Promise<QuickFlowPlan | null> => {
  if (!deterministicPlan) return null;
  if (!enabled || !planner) return deterministicPlan;

  try {
    const refined = await planner({ intent: intent.trim(), deterministicPlan });
    return refined ?? deterministicPlan;
  } catch {
    return deterministicPlan;
  }
};

/**
 * AI is an enhancement, never a dependency. Any provider error or invalid
 * response falls back to the existing deterministic planner.
 */
export async function planWithOptionalAI(
  input: string,
  provider?: AIPlanProvider,
): Promise<OptionalPlanResult> {
  const deterministic = planFromIntent(input);
  if (!provider) return { plan: deterministic, source: 'deterministic' };

  try {
    const candidate = await provider(input);
    if (!candidate) return { plan: deterministic, source: 'deterministic' };
    const plan = validateExecutionPlan(candidate);
    return { plan, source: 'ai' };
  } catch {
    return { plan: deterministic, source: 'deterministic' };
  }
}
