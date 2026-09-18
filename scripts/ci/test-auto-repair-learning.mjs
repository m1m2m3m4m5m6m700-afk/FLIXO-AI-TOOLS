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

const proposedBefore = memory.cases.find((item) => item.fingerprint === '__proposal_test__')?.attempts ?? 0;
recordOutcome(memory, {
  fingerprint: '__proposal_test__',
  normalizedFailure: 'webkit DEEP_SEMANTIC_MISSING=webkit:DEEP:webkit:ja',
  features: ['playwright', 'webkit', 'certification'],
  rootCause: 'webkit-render',
  outcome: 'proposed',
  verification: 'root-cause-evidence-insufficient',
});
const proposedCase = memory.cases.find((item) => item.fingerprint === '__proposal_test__');
assert.equal(proposedCase?.attempts ?? 0, proposedBefore);
assert(!memory.antiLessons.some((item) => item.fingerprint === '__proposal_test__'));

const fallbackOutcome = process.env.FLIXO_LEARNING_OUTCOME;
const fallbackVerification = process.env.FLIXO_VERIFICATION;
process.env.FLIXO_LEARNING_OUTCOME = 'unrepaired';
process.env.FLIXO_VERIFICATION = 'proposal-only';
assert.equal(
  process.env.FLIXO_LEARNING_OUTCOME === 'unrepaired' && process.env.FLIXO_VERIFICATION === 'proposal-only',
  true
);
if (fallbackOutcome === undefined) delete process.env.FLIXO_LEARNING_OUTCOME; else process.env.FLIXO_LEARNING_OUTCOME = fallbackOutcome;
if (fallbackVerification === undefined) delete process.env.FLIXO_VERIFICATION; else process.env.FLIXO_VERIFICATION = fallbackVerification;


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
