import assert from 'node:assert/strict';
import { createExecutionPlan } from './planner.ts';

const contract = (id, dependencies = []) => ({
  id, version: 1, gate: 'TEST', name: id, dependencies, inputs: [], outputs: [], evaluator: id,
  scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never',
  freshness: 'dependency', escalation: { deep: false, full: false },
});

const contracts = [contract('A'), contract('B', ['A']), contract('C', ['A']), contract('D', ['B', 'C'])];
const input = { commitSha: 'abc', baseSha: 'base', mode: 'L1', requestedContracts: ['D'], contractHash: 'hash', contracts };
const first = createExecutionPlan(input);
const second = createExecutionPlan(input);

assert.deepEqual(first, second);
assert.deepEqual(first.contractIds, ['A', 'B', 'C', 'D']);
assert.deepEqual(first.executionOrder, ['A', 'B', 'C', 'D']);
assert.equal(first.planHash.length, 64);

const changed = createExecutionPlan({ ...input, mode: 'L2' });
assert.notEqual(changed.planHash, first.planHash);

console.log('CI planner determinism PASS');
