import { z } from 'zod';
import { EXECUTABLE_PIPELINE_TOOL_IDS } from '@/lib/workflows/executable-tools';
import { getCapability, validateCapabilityParameters } from '@/lib/agent/capability-registry';

export const MAX_PLAN_STEPS = 4;
const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);
const EXECUTABLE_TOOL_ENUM = z.enum(
  [...EXECUTABLE_PIPELINE_TOOL_IDS] as [
    (typeof EXECUTABLE_PIPELINE_TOOL_IDS)[number],
    ...(typeof EXECUTABLE_PIPELINE_TOOL_IDS)[number][],
  ],
);

export const ExecutionPlanSchema = z.object({
  workflowName: z.string().trim().min(1).max(160),
  confidence: z.number().finite().min(0).max(1),
  steps: z.array(z.object({
    toolId: EXECUTABLE_TOOL_ENUM,
    params: z.record(z.string().max(64), scalar).optional(),
  })).min(1).max(MAX_PLAN_STEPS),
}).strict();

export type ExecutionPlanContract = z.infer<typeof ExecutionPlanSchema>;

export function parseExecutionPlan(value: unknown): ExecutionPlanContract {
  const plan = ExecutionPlanSchema.parse(value);
  for (const step of plan.steps) {
    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      throw new Error(`Execution plan references non-executable capability: ${step.toolId}`);
    }
    validateCapabilityParameters(step.toolId, step.params ?? {});
  }
  return plan;
}

export function safeParseExecutionPlan(value: unknown) {
  const parsed = ExecutionPlanSchema.safeParse(value);
  if (!parsed.success) return parsed;
  try {
    return { success: true as const, data: parseExecutionPlan(parsed.data) };
  } catch (error) {
    return {
      success: false as const,
      error: new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: error instanceof Error ? error.message : 'Execution plan failed capability validation.',
      }]),
    };
  }
}
