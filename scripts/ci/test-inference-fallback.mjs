import assert from 'node:assert/strict';
import { inferFailureResolution } from './inference-fallback.mjs';

const SHA = 'a'.repeat(40);
const log = [
  'ESLint failure',
  'error:  no-unused-vars  value is defined but never used',
  'src/example.ts:12:7',
].join('\n');

const memory = {
  cases: [],
  lessons: [{
    id: 'lesson-1',
    rootCause: 'lint',
    rule: 'eslint-unused',
    confidence: 0.9,
    attempts: 5,
    successes: 5,
    failures: 0,
  }],
  antiLessons: [],
  playbooks: [{
    rootCause: 'lint',
    rule: 'eslint-unused',
    attempts: 5,
    successes: 5,
    failures: 0,
    successfulFingerprints: ['fp-a', 'fp-b', 'fp-c'],
  }],
};

const historical = [
  {
    id: 'H1',
    errorClass: 'lint',
    workflow: 'CI',
    job: 'Static',
    normalized: 'error: no-unused-vars value is defined but never used',
    lastSeen: '2026-09-18T00:00:00Z',
    shas: [SHA],
  },
  {
    id: 'H2',
    errorClass: 'typescript',
    workflow: 'CI',
    job: 'Typecheck',
    normalized: 'error TS2304 cannot find name value',
    lastSeen: '2026-09-19T00:00:00Z',
    shas: [SHA],
  },
];

const diagnosis = {
  rootCause: 'UNKNOWN_RCA',
  directFailureSignal: true,
  location: { file: 'src/example.ts', line: 12 },
};

const inferred = inferFailureResolution({
  log,
  memory,
  targetSha: SHA,
  diagnosis,
  historicalRecordsOverride: historical,
});

assert.equal(inferred.authority, 'DETERMINISTIC_INFERENCE_FALLBACK');
assert.equal(inferred.mode, 'FALLBACK');
assert.equal(inferred.inferredClass?.errorClass, 'lint');
assert.equal(inferred.hypothesis.strategyId, 'eslint-unused');
assert.equal(inferred.hypothesis.mutationCapable, true);
assert.equal(inferred.prediction.eligibleForBoundedMutation, true);
assert.equal(inferred.safety.currentExactShaRequired, true);
assert.equal(inferred.safety.canonicalCiRequired, true);
assert(inferred.nearestHistoricalCases.length >= 1);
assert(inferred.falsification.length >= 4);

const unsafe = inferFailureResolution({
  log: 'unknown infrastructure thing',
  memory,
  targetSha: SHA,
  diagnosis: { rootCause: 'UNKNOWN_RCA', directFailureSignal: false },
  historicalRecordsOverride: [],
});
assert.equal(unsafe.prediction.eligibleForBoundedMutation, false);
assert.equal(unsafe.safety.failClosed, true);

const predictionHistory = [
  ...historical,
  {
    id: 'H3',
    errorClass: 'build',
    workflow: 'CI',
    job: 'Build',
    normalized: 'build failed after typecheck',
    lastSeen: '2026-09-20T00:00:00Z',
    shas: [SHA],
  },
];
const predicted = inferFailureResolution({
  log,
  memory,
  targetSha: SHA,
  diagnosis,
  historicalRecordsOverride: predictionHistory,
});
assert.equal(predicted.prediction.predictionBasis, 'historical-class-transition');
assert.equal(predicted.prediction.nextFailureClasses[0].from, 'lint');

console.log('INFERENCE_FALLBACK_CONTRACT=PASS');
