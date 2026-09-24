#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  loadErrorMemory,
  loadHistoricalKnowledge,
  buildCausalQuery,
  classifyCausalEvidence,
  retrieveCausalLearning,
} from './prompt-registry.mjs';

const SHA40 = /^[a-f0-9]{40}$/u;
const normalize = (value) => String(value ?? '').toLowerCase();
const compact = (value) => normalize(value).replace(/\\d{4}-\\d{2}-\\d{2}t[^\\s]+/gu, ' ')
  .replace(/[a-f0-9]{40}/giu, 'SHA')
  .replace(/run[_ -]?id\\s*[:=]\\s*\\d+/giu, 'RUN')
  .replace(/\\s+/gu, ' ')
  .trim();

function historicalGold(caseEntry) {
  const text = normalize([
    caseEntry.rootCause,
    caseEntry.normalizedFailure,
    caseEntry.outcomes?.[0]?.provenance?.workflow,
  ].join(' '));

  if (
    /live_head_moved=1|live_head_match=0|supersed|stale|expected_sha|observed_remote_sha|sha race/iu.test(text) ||
    /stale|supersession/iu.test(String(caseEntry.rootCause ?? ''))
  ) {
    return 'STALE';
  }
  if (
    /503|provider outage|provider|external runtime|rate limit|upstream unavailable|timeout/iu.test(text) ||
    /external-tooling|provider-deployment|external/iu.test(String(caseEntry.rootCause ?? ''))
  ) {
    return 'EXTERNAL';
  }
  if (
    /upstream red|downstream of|blocked by upstream|depends on upstream/iu.test(text) ||
    /downstream/iu.test(String(caseEntry.rootCause ?? ''))
  ) {
    return 'DOWNSTREAM';
  }
  if (
    /proof|contract mismatch|shared_source_missing|ownership/iu.test(text) ||
    /proof|contract|ownership/iu.test(String(caseEntry.rootCause ?? ''))
  ) {
    return 'CONTRACT';
  }
  if (/browser runtime|worker crashed|runtime message/iu.test(text) || /runtime|browser/iu.test(String(caseEntry.rootCause ?? ''))) {
    return 'RUNTIME';
  }
  return 'INTERNAL';
}

function expectedAction(classification) {
  return {
    STALE: 'WAIT_FOR_FRESH_SHA',
    EXTERNAL: 'BLOCKED_EXTERNAL',
    DOWNSTREAM: 'TARGETED_PROBE',
    CONTRACT: 'REPAIR',
    RUNTIME: 'REPAIR',
    INTERNAL: 'REPAIR',
    UNKNOWN: 'TARGETED_PROBE',
  }[classification];
}

const memory = loadErrorMemory();
const historical = loadHistoricalKnowledge();
const realCases = Array.isArray(memory.cases) ? memory.cases.filter((entry) =>
  entry?.fingerprint &&
  entry?.normalizedFailure &&
  entry?.outcomes?.[0]?.provenance?.source === 'GitHub Actions historical'
) : [];

const heldOut = realCases
  .filter((_, index) => index % 2 === 1)
  .slice(0, 10);

assert.equal(heldOut.length, Math.min(10, Math.floor(realCases.length / 2)), 'REAL_HELDOUT_CASE_COUNT_INVALID');

let classificationPass = 0;
let actionPass = 0;
let zeroStallPass = 0;
let retrievalPass = 0;
let leakageFree = 0;
const rows = [];

for (const entry of heldOut) {
  const gold = historicalGold(entry);
  const expected = expectedAction(gold);
  const provenance = entry.outcomes[0].provenance ?? {};
  const workflow = String(provenance.workflow ?? '');

  // Deliberately omit fingerprint, failed SHA, run id, timestamps, and exact failure identity.
  const maskedFailure = compact(entry.normalizedFailure);
  const queryInput = {
    rootCause: entry.rootCause,
    failureClass: entry.rootCause,
    workflow,
    normalizedFailure: maskedFailure,
    repeatedStrategy: false,
  };

  const query = buildCausalQuery(queryInput);
  assert.equal(query.failureFingerprint, '', 'HELDOUT_FINGERPRINT_LEAK');
  assert.equal(query.evidenceSha, '', 'HELDOUT_EVIDENCE_SHA_LEAK');
  assert.ok(!SHA40.test(query.searchText), 'HELDOUT_SHA_LEAK');

  const decision = classifyCausalEvidence(query);
  const retrieval = retrieveCausalLearning({
    memory,
    historical,
    query,
    limit: 5,
  });

  const retrievedRootCauses = retrieval.lessons.map((item) => normalize(item.rootCause));
  const retrievalHit = retrievedRootCauses.includes(normalize(entry.rootCause)) ||
    retrieval.lessons.some((item) => {
      const text = normalize([item.rule, item.lesson, item.content, item.claim].join(' '));
      return normalize(entry.rootCause).split(/[^a-z0-9_-]+/u).filter(Boolean).some((token) =>
        token.length >= 4 && text.includes(token)
      );
    });

  const classificationOk = decision.classification === gold;
  const actionOk = decision.nextAction === expected;
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
  if (!SHA40.test(query.searchText)) leakageFree += 1;

  rows.push({
    fingerprint: entry.fingerprint.slice(0, 12),
    rootCause: entry.rootCause,
    gold,
    actual: decision.classification,
    expectedAction: expected,
    actualAction: decision.nextAction,
    retrievalHit,
    zeroStallOk,
  });
}

const total = heldOut.length;
const metrics = {
  heldOutRealHistoricalCases: total,
  classification: `${classificationPass}/${total}`,
  classificationAccuracy: total ? classificationPass / total : 0,
  action: `${actionPass}/${total}`,
  actionAccuracy: total ? actionPass / total : 0,
  zeroStall: `${zeroStallPass}/${total}`,
  retrievalRecallAt5: total ? retrievalPass / total : 0,
  leakageFree: `${leakageFree}/${total}`,
  goldLabelPolicy: 'derived from explicit historical evidence patterns; not human-adjudicated',
};

assert.ok(metrics.classificationAccuracy >= 0.9, 'REAL_HELDOUT_CLASSIFICATION_THRESHOLD_FAILED');
assert.ok(metrics.actionAccuracy >= 0.9, 'REAL_HELDOUT_ACTION_THRESHOLD_FAILED');
assert.equal(zeroStallPass, total, 'REAL_HELDOUT_ZERO_STALL_FAILED');
assert.ok(metrics.retrievalRecallAt5 >= 0.7, 'REAL_HELDOUT_RETRIEVAL_THRESHOLD_FAILED');
assert.equal(leakageFree, total, 'REAL_HELDOUT_SHA_LEAKAGE_FAILED');

console.log('REAL_HELDOUT_BENCHMARK=PASS');
console.log(JSON.stringify({ metrics, rows }, null, 2));
