import assert from 'node:assert/strict';
import { fingerprintFailure, loadMemory, recordOutcome, scorePlaybook, findSimilarCases, rankLessons } from './auto-repair-learning.mjs';

const sample = 'Run 35012345678 failed on webkit at abcdefabcdefabcdefabcdefabcdefabcdefabcd: Seed waitForGpuRender';
const fingerprint = fingerprintFailure(sample);
assert(!fingerprint.includes('35012345678'));
assert(!fingerprint.includes('abcdefabcdefabcdefabcdefabcdefabcdefabcd'));

const memory = loadMemory();
assert.equal(memory.version, 7);
const before = memory.cases.length;
recordOutcome(memory, {
  fingerprint: '__self_test__',
  normalizedFailure: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'success',
  verification: 'passed',
});
assert.equal(memory.cases.length, before + (memory.cases.some((item) => item.fingerprint === '__self_test__') ? 0 : 1));
assert.equal(scorePlaybook(memory, 'lint', 'eslint-unused'), 1);
assert(memory.lessons.some((item) => item.fingerprint === '__self_test__'));

recordOutcome(memory, {
  fingerprint: '__negative_test__',
  normalizedFailure: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'failure',
  verification: 'failed',
});
assert(memory.antiLessons.some((item) => item.fingerprint === '__negative_test__'));

const similar = findSimilarCases(memory, {
  fingerprint: '__different_test__',
  normalized: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
});
assert(similar.some((item) => item.case.fingerprint === '__self_test__'));
assert(similar[0].score >= 0.45);

const ranked = rankLessons(memory, { fingerprint: '__self_test__' });
assert(ranked.some((item) => item.fingerprint === '__self_test__' && !item.anti));

console.log('AUTO_REPAIR_LEARNING_SELF_TEST=PASS');
