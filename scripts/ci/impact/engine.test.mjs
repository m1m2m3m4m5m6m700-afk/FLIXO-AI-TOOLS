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

const g3Adapter = calculateImpact(
  ['tests/helpers/upload-file.ts'],
  [
    ...contracts,
    { id: 'G3-DOWNLOAD-001', version: 1, gate: 'G3', name: 'Download', dependencies: [], inputs: [], outputs: [], evaluator: 'g3-download', scope: 'artifact', severity: 'critical', execution: 'browser', reusable: true, retry: 'controlled', freshness: 'dependency', escalation: { deep: true, full: true } },
  ],
);
assert.deepEqual(g3Adapter.affectedContracts, ['G3-DOWNLOAD-001']);
assert.equal(g3Adapter.escalation, 'L1');
assert.equal(g3Adapter.conservative, false);

console.log('CI impact engine safety PASS');
