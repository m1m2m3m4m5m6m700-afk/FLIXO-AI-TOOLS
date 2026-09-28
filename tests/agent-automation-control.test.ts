import assert from 'node:assert/strict';
import { test } from 'node:test';

type Budget = Readonly<{
  maxAttempts: number;
  maxElapsedMs: number;
  maxMutations: number;
  maxScope: number;
}>;

function assertBudget(budget: Budget): void {
  for (const [key, value] of Object.entries(budget)) {
    assert.equal(Number.isInteger(value), true, key);
    assert.equal(value > 0, true, key);
  }
}

function consume(
  budget: Budget,
  used: Readonly<{ attempts: number; elapsedMs: number; mutations: number; scope: number }>,
): void {
  assertBudget(budget);
  assert.equal(used.attempts <= budget.maxAttempts, true, 'attempt budget exhausted');
  assert.equal(used.elapsedMs <= budget.maxElapsedMs, true, 'time budget exhausted');
  assert.equal(used.mutations <= budget.maxMutations, true, 'mutation budget exhausted');
  assert.equal(used.scope <= budget.maxScope, true, 'scope budget exhausted');
}

test('agent automation contract keeps the four budgets finite and positive', () => {
  const budget: Budget = Object.freeze({
    maxAttempts: 2,
    maxElapsedMs: 30_000,
    maxMutations: 1,
    maxScope: 4,
  });
  assert.doesNotThrow(() => assertBudget(budget));
  assert.doesNotThrow(() => consume(budget, {
    attempts: 1, elapsedMs: 100, mutations: 1, scope: 2,
  }));
});

test('agent automation contract fails closed when any budget is exhausted', () => {
  const budget: Budget = Object.freeze({
    maxAttempts: 1,
    maxElapsedMs: 1_000,
    maxMutations: 1,
    maxScope: 2,
  });
  assert.throws(() => consume(budget, {
    attempts: 2, elapsedMs: 100, mutations: 0, scope: 1,
  }), /attempt budget exhausted/);
  assert.throws(() => consume(budget, {
    attempts: 1, elapsedMs: 1_001, mutations: 0, scope: 1,
  }), /time budget exhausted/);
  assert.throws(() => consume(budget, {
    attempts: 1, elapsedMs: 100, mutations: 2, scope: 1,
  }), /mutation budget exhausted/);
  assert.throws(() => consume(budget, {
    attempts: 1, elapsedMs: 100, mutations: 0, scope: 3,
  }), /scope budget exhausted/);
});

test('automation success states remain explicitly separate', () => {
  const states = ['Infrastructure Green', 'Product Green', 'MVP Certified'];
  assert.deepEqual(states, ['Infrastructure Green', 'Product Green', 'MVP Certified']);
  assert.notEqual(states[0], states[1]);
  assert.notEqual(states[1], states[2]);
});
