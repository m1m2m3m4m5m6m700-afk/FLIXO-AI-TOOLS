import assert from 'node:assert/strict';
import { computeCiDecision } from './status.ts';

const base = {
  gate: 'TEST', contractVersion: 1, severity: 'critical', scope: {}, durationMs: 1,
};

const pass = computeCiDecision([{ ...base, contract: 'CI-TEST-PASS', status: 'PASS' }]);
assert.equal(pass.status, 'PASS');

const fail = computeCiDecision([
  { ...base, contract: 'CI-TEST-FAIL', status: 'FAIL' },
  { ...base, contract: 'CI-TEST-BLOCKED', status: 'BLOCKED' },
]);
assert.equal(fail.status, 'FAIL');
assert.deepEqual(fail.requiredFailures, ['CI-TEST-FAIL']);
assert.deepEqual(fail.requiredBlocked, ['CI-TEST-BLOCKED']);

const blocked = computeCiDecision([{ ...base, contract: 'CI-TEST-BLOCKED', status: 'BLOCKED' }]);
assert.equal(blocked.status, 'BLOCKED');
assert.equal(blocked.requiredBlocked.length, 1);

console.log('CI decision semantics PASS');
