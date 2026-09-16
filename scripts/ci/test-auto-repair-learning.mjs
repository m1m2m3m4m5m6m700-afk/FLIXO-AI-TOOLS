import assert from 'node:assert/strict';
import { fingerprintFailure, loadMemory, recordOutcome, scorePlaybook } from './auto-repair-learning.mjs';

const sample = 'Run 35012345678 failed on webkit at abcdefabcdefabcdefabcdefabcdefabcdefabcd: Seed waitForGpuRender';
const fingerprint = fingerprintFailure(sample);
assert(!fingerprint.includes('35012345678'));
assert(!fingerprint.includes('abcdefabcdefabcdefabcdefabcdefabcdefabcd'));

const memory = loadMemory();
const before = memory.cases.length;
recordOutcome(memory, {
  fingerprint: '__self_test__',
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'success',
  verification: 'passed',
});
assert.equal(memory.cases.length, before + (memory.cases.some((item) => item.fingerprint === '__self_test__') ? 0 : 1));
assert.equal(scorePlaybook(memory, 'lint', 'eslint-unused'), 1);

console.log('AUTO_REPAIR_LEARNING_SELF_TEST=PASS');
