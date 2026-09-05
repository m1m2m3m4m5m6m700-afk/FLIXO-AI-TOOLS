import assert from 'node:assert/strict';
import { blockedResults, dependencyClosure, topologicalOrder, validateDependencyGraph } from './graph.ts';

const contract = (id, dependencies = []) => ({
  id,
  version: 1,
  gate: 'TEST',
  name: id,
  dependencies,
  inputs: [],
  outputs: [],
  evaluator: id,
  scope: 'repository',
  severity: 'critical',
  execution: 'static',
  reusable: true,
  retry: 'never',
  freshness: 'dependency',
  escalation: { deep: false, full: false },
});

const graph = [
  contract('A'),
  contract('B', ['A']),
  contract('C', ['A']),
  contract('D', ['B', 'C']),
];

validateDependencyGraph(graph);
assert.deepEqual(topologicalOrder(graph), ['A', 'B', 'C', 'D']);
assert.deepEqual(dependencyClosure(['D'], graph), ['A', 'B', 'C', 'D']);

assert.throws(() => validateDependencyGraph([contract('X', ['Y']), contract('Y', ['X'])]), /cycle/i);
assert.throws(() => validateDependencyGraph([contract('X', ['MISSING'])]), /Unknown dependency node/i);

const baseResult = (contractId, status) => ({
  gate: 'TEST',
  contract: contractId,
  contractVersion: 1,
  status,
  severity: 'critical',
  scope: {},
});

const blocked = blockedResults([
  baseResult('A', 'FAIL'),
  baseResult('B', 'PASS'),
  baseResult('C', 'PASS'),
  baseResult('D', 'PASS'),
], graph);

assert.equal(blocked.find((result) => result.contract === 'A')?.status, 'FAIL');
assert.equal(blocked.find((result) => result.contract === 'B')?.status, 'BLOCKED');
assert.equal(blocked.find((result) => result.contract === 'C')?.status, 'BLOCKED');
assert.equal(blocked.find((result) => result.contract === 'D')?.status, 'BLOCKED');

console.log('CI graph semantics PASS');
