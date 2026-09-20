import { z } from 'zod';
import { getCapability, validateCapabilityParameters } from '@/lib/agent/capability-registry';
import { TOOL_CATALOG } from '@/config/registry';

export const MAX_PLAN_STEPS = 4;
const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);
const executableToolId = z.string().trim().min(1).refine(
  (id) => getCapability(id)?.state === 'EXECUTABLE',
  { message: 'Tool must be registered and executable.' },
);

export const ExecutionPlanSchema = z.object({
  workflowName: z.string().trim().min(1).max(160),
  confidence: z.number().finite().min(0).max(1),
  catalogFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  steps: z.array(z.object({
    toolId: executableToolId,
    params: z.record(z.string().max(64), scalar).optional(),
  })).min(1).max(MAX_PLAN_STEPS),
}).strict();

export type ExecutionPlanContract = Omit<z.infer<typeof ExecutionPlanSchema>, 'catalogFingerprint'> & { catalogFingerprint: string };

export function parseExecutionPlan(value: unknown): ExecutionPlanContract {
  const plan = ExecutionPlanSchema.parse(value);
  const catalogFingerprint = plan.catalogFingerprint ?? TOOL_CATALOG.fingerprint;
  if (catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Execution plan was created against a different canonical tool catalog.');
  }
  for (const step of plan.steps) {
    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      throw new Error(`Execution plan references non-executable capability: ${step.toolId}`);
    }
    validateCapabilityParameters(step.toolId, step.params ?? {});
  }
  return Object.freeze({ ...plan, catalogFingerprint });
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
