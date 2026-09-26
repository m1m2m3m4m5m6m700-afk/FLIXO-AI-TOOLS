import { z } from 'zod';

export const TASK_BUDGET_VERSION = 1 as const;

export const TaskBudgetSchema = z.object({
  version: z.literal(TASK_BUDGET_VERSION),
  maxSteps: z.number().int().min(1).max(32),
  maxToolCalls: z.number().int().min(1).max(64),
  maxProviderCalls: z.number().int().min(0).max(8),
  maxRetries: z.number().int().min(0).max(8),
  maxLatencyMs: z.number().int().min(250).max(600_000),
  maxInputBytes: z.number().int().min(1).max(256 * 1024 * 1024),
  maxOutputBytes: z.number().int().min(1).max(256 * 1024 * 1024),
}).strict();

export type TaskBudget = z.infer<typeof TaskBudgetSchema>;

export type TaskBudgetUsage = Readonly<{
  steps: number;
  toolCalls: number;
  providerCalls: number;
  retries: number;
  startedAtMs: number;
}>;

export const DEFAULT_TASK_BUDGET: TaskBudget = Object.freeze({
  version: TASK_BUDGET_VERSION,
  maxSteps: 12,
  maxToolCalls: 16,
  maxProviderCalls: 2,
  maxRetries: 3,
  maxLatencyMs: 120_000,
  maxInputBytes: 64 * 1024 * 1024,
  maxOutputBytes: 64 * 1024 * 1024,
});

export function createTaskBudget(overrides: Partial<Omit<TaskBudget, 'version'>> = {}): TaskBudget {
  return TaskBudgetSchema.parse({ ...DEFAULT_TASK_BUDGET, ...overrides });
}

export function assertWithinTaskBudget(
  budget: TaskBudget,
  usage: TaskBudgetUsage,
  next: Partial<Omit<TaskBudgetUsage, 'startedAtMs'>> = {},
  nowMs = Date.now(),
): void {
  const projected = {
    steps: usage.steps + (next.steps ?? 0),
    toolCalls: usage.toolCalls + (next.toolCalls ?? 0),
    providerCalls: usage.providerCalls + (next.providerCalls ?? 0),
    retries: usage.retries + (next.retries ?? 0),
  };
  if (projected.steps > budget.maxSteps) throw new Error('TASK_BUDGET_STEPS_EXCEEDED');
  if (projected.toolCalls > budget.maxToolCalls) throw new Error('TASK_BUDGET_TOOL_CALLS_EXCEEDED');
  if (projected.providerCalls > budget.maxProviderCalls) throw new Error('TASK_BUDGET_PROVIDER_CALLS_EXCEEDED');
  if (projected.retries > budget.maxRetries) throw new Error('TASK_BUDGET_RETRIES_EXCEEDED');
  if (nowMs - usage.startedAtMs > budget.maxLatencyMs) throw new Error('TASK_BUDGET_LATENCY_EXCEEDED');
}
