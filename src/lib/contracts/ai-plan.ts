import { z } from 'zod';
import { EXECUTABLE_PIPELINE_TOOL_IDS } from '@/lib/workflows/executable-tools';

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
export function parseExecutionPlan(value: unknown): ExecutionPlanContract { return ExecutionPlanSchema.parse(value); }
export function safeParseExecutionPlan(value: unknown) { return ExecutionPlanSchema.safeParse(value); }
