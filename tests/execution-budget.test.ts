import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertExecutionBudgets, assertExecutionWithinBudget } from '@/lib/agent/execution-budget.ts';

const budgets = Object.freeze({
  maxAttempts: 3,
  maxTimeMs: 30_000,
  maxMutations: 2,
  maxScope: 5,
});

test('execution budgets require all four finite positive limits', () => {
  assert.doesNotThrow(() => assertExecutionBudgets(budgets));
});

test('execution budgets fail closed at every boundary', () => {
  assert.throws(() => assertExecutionWithinBudget(budgets, {
    attempts: 3, elapsedMs: 0, mutations: 0, scope: 0,
  }), /ATTEMPTS_EXHAUSTED/);
  assert.throws(() => assertExecutionWithinBudget(budgets, {
    attempts: 0, elapsedMs: 30_000, mutations: 0, scope: 0,
  }), /TIME_EXHAUSTED/);
  assert.throws(() => assertExecutionWithinBudget(budgets, {
    attempts: 0, elapsedMs: 0, mutations: 2, scope: 0,
  }), /MUTATIONS_EXHAUSTED/);
  assert.throws(() => assertExecutionWithinBudget(budgets, {
    attempts: 0, elapsedMs: 0, mutations: 0, scope: 5,
  }), /SCOPE_EXHAUSTED/);
});
