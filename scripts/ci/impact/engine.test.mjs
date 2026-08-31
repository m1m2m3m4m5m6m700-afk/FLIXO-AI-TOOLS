import assert from 'node:assert/strict';
import { calculateImpact } from './engine.ts';

const contracts = [
  { id: 'CI-A', version: 1, gate: 'TEST', name: 'A', dependencies: [], inputs: [], outputs: [], evaluator: 'a', scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true } },
  { id: 'CI-B', version: 1, gate: 'TEST', name: 'B', dependencies: [], inputs: [], outputs: [], evaluator: 'b', scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true } },
];
const rules = [
  { pattern: 'src/a/**', contracts: ['CI-A'], escalateTo: 'L1', reason: 'A source changed' },
];

const affected = calculateImpact(['src/a/x.ts'], contracts, rules);
assert.deepEqual(affected.affectedContracts, ['CI-A']);
assert.equal(affected.escalation, 'L1');
assert.equal(affected.conservative, false);

const unaffected = calculateImpact(['docs/readme.md'], contracts, rules);
assert.deepEqual(unaffected.affectedContracts, ['CI-A', 'CI-B']);
assert.equal(unaffected.escalation, 'L3');
assert.equal(unaffected.conservative, true);

const ambiguous = calculateImpact(['src/unknown/x.ts'], contracts, rules);
assert.equal(ambiguous.conservative, true);
assert.equal(ambiguous.escalation, 'L3');
assert.deepEqual(ambiguous.affectedContracts, ['CI-A', 'CI-B']);

console.log('CI impact engine safety PASS');
