#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  loadErrorMemory,
  loadHistoricalKnowledge,
  buildCausalQuery,
  classifyCausalEvidence,
  retrieveCausalLearning,
} from './prompt-registry.mjs';

const ISO_TS = /\\b\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z\\b/giu;
const SHA40 = /\\b[a-f0-9]{40}\\b/giu;
const LONG_RUN_NUMBER = /\\b(?:run[_ -]?id|run)\\s*[:=#]?\\s*\\d{6,}\\b/giu;
const UUID = /\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b/giu;

const normalize = (value) => String(value ?? '').toLowerCase();
const sanitizeHistoricalLog = (value) => String(value ?? '')
  .replace(ISO_TS, '<TIME>')
  .replace(SHA40, '<SHA>')
  .replace(LONG_RUN_NUMBER, '<RUN>')
  .replace(UUID, '<UUID>')
  .replace(/https?:\/\/[^\s]+/giu, '<URL>')
  .replace(/\s+/gu, ' ')
  .trim();

const CASES = Object.freeze([
  {
    id: 'stale-branch-identity',
    fingerprint: 'b6d4e5d4153f58631c67b426690afcfa2dbdd2ecae30c011051d3cea3eba9c64',
    expectedClass: 'STALE',
    expectedAction: 'WAIT_FOR_FRESH_SHA',
    rationale: 'Historical proof compares a non-execution branch to execution and therefore targets stale evidence.',
  },
  {
    id: 'external-action-resolution',
    fingerprint: '8ba70fb57a722ff30b0dafec92a9aacf6ba6f286ead1d2bb477f1b9840b07dc5',
    expectedClass: 'EXTERNAL',
    expectedAction: 'BLOCKED_EXTERNAL',
    rationale: 'GitHub runner could not resolve a referenced external action commit.',
  },
  {
    id: 'contract-certification-surface',
    fingerprint: '6daeedbea89e727478dfd0eac0ac64fb336e6140611f8d6ba48755123b89f04c',
    expectedClass: 'CONTRACT',
    expectedAction: 'REPAIR',
    rationale: 'Canonical certification-surface validator failed and exposed a trust-contract mismatch.',
  },
  {
    id: 'internal-typecheck-admin',
    fingerprint: '0393de4416e5b0f0ece88db992f6602c08cba073e0fec44b9287551dce100716',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    rationale: 'TypeScript compiler produced a concrete source error in project code.',
  },
  {
    id: 'internal-typecheck-compressor',
    fingerprint: '4f932e3819b76dc0a24095bca7c5ba05650e43b4ec49922a074bc7927606184a',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    rationale: 'TypeScript compiler reported missing exported members in project source.',
  },
  {
    id: 'internal-typecheck-cropper',
    fingerprint: '46899dec92850fd77d23d9f4806abc953d4d071feed50b2d25a9bf199b55aaa3',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    rationale: 'TypeScript compiler reported an invalid lazy-import shape in canonical tool source.',
  },
  {
    id: 'internal-typescript-multi-error',
    fingerprint: '8ea67f8fc4ae327e3b3654ac5ee762c4a3d446d21cb0610aa63ac2eccecea8f5',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    rationale: 'TypeScript compiler emitted multiple concrete source errors.',
  },
  {
    id: 'internal-syntax-error',
    fingerprint: '0268fbbaae1969e762f85d8e8dad911180350c3d60634c32ec63aed21ad69714',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    rationale: 'Node reported ERR_INVALID_TYPESCRIPT_SYNTAX from a project source file.',
  },
  {
    id: 'unknown-runner-observation',
    fingerprint: 'fbe5a42fb8a5af9e6d55dad1cd9d0a654ffb6f351e160f7921f78d3818bdec18',
    expectedClass: 'UNKNOWN',
    expectedAction: 'TARGETED_PROBE',
    rationale: 'Historical log is dominated by runner bootstrap output without a discriminating causal failure signal.',
  },
]);

const memory = loadErrorMemory();
const historical = loadHistoricalKnowledge();
const byFingerprint = new Map((memory.cases ?? []).map((entry) => [entry.fingerprint, entry]));

assert.ok(CASES.length >= 9, 'REAL_HELDOUT_FIXTURE_TOO_SMALL');

let classificationPass = 0;
let actionPass = 0;
let zeroStallPass = 0;
let retrievalPass = 0;
let leakageFree = 0;
const rows = [];

for (const fixture of CASES) {
  const entry = byFingerprint.get(fixture.fingerprint);
  assert.ok(entry, `HISTORICAL_CASE_MISSING:${fixture.id}`);
  assert.equal(
    entry?.outcomes?.[0]?.provenance?.source,
    'GitHub Actions historical',
    `NON_HISTORICAL_CASE:${fixture.id}`,
  );

  const query = buildCausalQuery({
    // Intentionally NO rootCause, failureClass, fingerprint, failed SHA, run ID,
    // strategy ID, cancellation reason, or exact source identifier.
    workflow: String(entry.outcomes?.[0]?.provenance?.workflow ?? ''),
    normalizedFailure: sanitizeHistoricalLog(entry.normalizedFailure),
    repeatedStrategy: false,
  });

  assert.equal(query.failureFingerprint, '', `FINGERPRINT_LEAK:${fixture.id}`);
  assert.equal(query.rootCause, '', `ROOT_CAUSE_LEAK:${fixture.id}`);
  assert.equal(query.failureClass, '', `FAILURE_CLASS_LEAK:${fixture.id}`);
  assert.equal(query.evidenceSha, '', `EVIDENCE_SHA_LEAK:${fixture.id}`);
  assert.ok(!SHA40.test(query.searchText), `SHA_LEAK:${fixture.id}`);
  assert.ok(!ISO_TS.test(query.searchText), `TIMESTAMP_LEAK:${fixture.id}`);
  assert.ok(!LONG_RUN_NUMBER.test(query.searchText), `RUN_ID_LEAK:${fixture.id}`);
  assert.ok(!UUID.test(query.searchText), `UUID_LEAK:${fixture.id}`);
  leakageFree += 1;

  const decision = classifyCausalEvidence(query);
  const retrieval = retrieveCausalLearning({
    memory,
    historical,
    query,
    limit: 5,
  });

  const retrievalHit = retrieval.lessons.some((item) => (
    item?.causalBehavior?.classification === fixture.expectedClass ||
    item?.rule === fixture.id
  ));

  const classificationOk = decision.classification === fixture.expectedClass;
  const actionOk = decision.nextAction === fixture.expectedAction;
  const zeroStallOk = [
    'REPAIR',
    'TARGETED_PROBE',
    'ESCALATE',
    'BLOCKED_EXTERNAL',
    'WAIT_FOR_FRESH_SHA',
  ].includes(decision.nextAction);

  if (classificationOk) classificationPass += 1;
  if (actionOk) actionPass += 1;
  if (zeroStallOk) zeroStallPass += 1;
  if (retrievalHit) retrievalPass += 1;

  rows.push({
    id: fixture.id,
    expectedClass: fixture.expectedClass,
    actualClass: decision.classification,
    expectedAction: fixture.expectedAction,
    actualAction: decision.nextAction,
    retrievalHit,
    zeroStallOk,
  });
}

const total = CASES.length;
const metrics = {
  heldOutRealHistoricalCases: total,
  classification: `${classificationPass}/${total}`,
  classificationAccuracy: classificationPass / total,
  action: `${actionPass}/${total}`,
  actionAccuracy: actionPass / total,
  zeroStall: `${zeroStallPass}/${total}`,
  retrievalRecallAt5: retrievalPass / total,
  leakageFree: `${leakageFree}/${total}`,
  goldLabelPolicy: 'manually curated from concrete historical log evidence; classifier inputs exclude rootCause and exact identifiers',
};

assert.ok(metrics.classificationAccuracy >= 0.9, 'REAL_HELDOUT_CLASSIFICATION_THRESHOLD_FAILED');
assert.ok(metrics.actionAccuracy >= 0.9, 'REAL_HELDOUT_ACTION_THRESHOLD_FAILED');
assert.equal(zeroStallPass, total, 'REAL_HELDOUT_ZERO_STALL_FAILED');
assert.ok(metrics.retrievalRecallAt5 >= 0.5, 'REAL_HELDOUT_RETRIEVAL_THRESHOLD_FAILED');
assert.equal(leakageFree, total, 'REAL_HELDOUT_LEAKAGE_THRESHOLD_FAILED');

console.log('REAL_HELDOUT_BENCHMARK=PASS');
console.log(JSON.stringify({ metrics, rows }, null, 2));
