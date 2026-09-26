export const EXECUTION_BUDGET_VERSION = 1 as const;

export type ExecutionBudgetLimits = Readonly<{
  maxSteps: number;
  maxToolCalls: number;
  maxRetries: number;
  maxElapsedMs: number;
  maxOutputBytes: number;
  maxModelTokens: number;
  maxCostMicrounits: number;
}>;

export type ExecutionBudgetUsage = Readonly<{
  steps: number;
  toolCalls: number;
  retries: number;
  elapsedMs: number;
  outputBytes: number;
  modelTokens: number;
  costMicrounits: number;
}>;

export type ExecutionBudget = Readonly<{
  version: typeof EXECUTION_BUDGET_VERSION;
  limits: ExecutionBudgetLimits;
  usage: ExecutionBudgetUsage;
  startedAtMs: number;
}>;

export const DEFAULT_EXECUTION_BUDGET: ExecutionBudgetLimits = Object.freeze({
  maxSteps: 4,
  maxToolCalls: 8,
  maxRetries: 6,
  maxElapsedMs: 120_000,
  maxOutputBytes: 64 * 1024 * 1024,
  maxModelTokens: 16_000,
  maxCostMicrounits: 100_000,
});

export function createExecutionBudget(
  limits: Partial<ExecutionBudgetLimits> = {},
  startedAtMs = Date.now(),
): ExecutionBudget {
  const merged = {
    ...DEFAULT_EXECUTION_BUDGET,
    ...limits,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`EXECUTION_BUDGET_LIMIT_INVALID:${key}`);
    }
  }

  return Object.freeze({
    version: EXECUTION_BUDGET_VERSION,
    limits: Object.freeze(merged),
    usage: Object.freeze({
      steps: 0,
      toolCalls: 0,
      retries: 0,
      elapsedMs: 0,
      outputBytes: 0,
      modelTokens: 0,
      costMicrounits: 0,
    }),
    startedAtMs,
  });
}

function next(budget: ExecutionBudget, delta: Partial<ExecutionBudgetUsage>): ExecutionBudget {
  const usage = Object.freeze({
    steps: budget.usage.steps + (delta.steps ?? 0),
    toolCalls: budget.usage.toolCalls + (delta.toolCalls ?? 0),
    retries: budget.usage.retries + (delta.retries ?? 0),
    elapsedMs: Math.max(0, Date.now() - budget.startedAtMs),
    outputBytes: budget.usage.outputBytes + (delta.outputBytes ?? 0),
    modelTokens: budget.usage.modelTokens + (delta.modelTokens ?? 0),
    costMicrounits: budget.usage.costMicrounits + (delta.costMicrounits ?? 0),
  });

  const checks: Array<[keyof ExecutionBudgetLimits, number, keyof ExecutionBudgetUsage]> = [
    ['maxSteps', usage.steps, 'steps'],
    ['maxToolCalls', usage.toolCalls, 'toolCalls'],
    ['maxRetries', usage.retries, 'retries'],
    ['maxElapsedMs', usage.elapsedMs, 'elapsedMs'],
    ['maxOutputBytes', usage.outputBytes, 'outputBytes'],
    ['maxModelTokens', usage.modelTokens, 'modelTokens'],
    ['maxCostMicrounits', usage.costMicrounits, 'costMicrounits'],
  ];

  for (const [limitKey, actual, usageKey] of checks) {
    if (actual > budget.limits[limitKey]) {
      throw new Error(`EXECUTION_BUDGET_EXCEEDED:${usageKey}`);
    }
  }

  return Object.freeze({ ...budget, usage });
}

export function consumeStep(budget: ExecutionBudget): ExecutionBudget {
  return next(budget, { steps: 1 });
}

export function consumeToolCall(budget: ExecutionBudget): ExecutionBudget {
  return next(budget, { toolCalls: 1 });
}

export function consumeRetry(budget: ExecutionBudget): ExecutionBudget {
  return next(budget, { retries: 1 });
}

export function consumeOutputBytes(budget: ExecutionBudget, byteLength: number): ExecutionBudget {
  if (!Number.isInteger(byteLength) || byteLength < 0) throw new Error('EXECUTION_BUDGET_OUTPUT_SIZE_INVALID');
  return next(budget, { outputBytes: byteLength });
}

export function consumeModelTokens(budget: ExecutionBudget, tokenCount: number): ExecutionBudget {
  if (!Number.isInteger(tokenCount) || tokenCount < 0) throw new Error('EXECUTION_BUDGET_TOKEN_COUNT_INVALID');
  return next(budget, { modelTokens: tokenCount });
}

export function consumeCost(budget: ExecutionBudget, costMicrounits: number): ExecutionBudget {
  if (!Number.isInteger(costMicrounits) || costMicrounits < 0) throw new Error('EXECUTION_BUDGET_COST_INVALID');
  return next(budget, { costMicrounits });
}

export function assertExecutionBudgetAlive(budget: ExecutionBudget): void {
  const elapsedMs = Math.max(0, Date.now() - budget.startedAtMs);
  if (elapsedMs > budget.limits.maxElapsedMs) {
    throw new Error('EXECUTION_BUDGET_EXCEEDED:elapsedMs');
  }
}
