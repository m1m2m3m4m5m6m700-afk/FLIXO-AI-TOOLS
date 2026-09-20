import assert from 'node:assert/strict';
import {
  trainRepairBot,
  partitionTrainingRows,
  buildGoldenReplaySet,
  derivePolicyLifecycle,
} from './repair-bot-training.mjs';

const sampleRows = [];
for (let i = 0; i < 36; i += 1) {
  sampleRows.push({
    source: 'verified-repair-memory',
    fingerprint: `case-${i}`,
    rootCause: i % 2 ? 'lint' : 'typescript',
    features: [i % 2 ? 'lint' : 'typescript'],
    failedSha: `failed-${i}`,
    targetSha: `target-${i}`,
    at: `2026-09-20T00:00:${String(i).padStart(2,'0')}Z`,
    strategyId: i % 3 ? 'reproduce-exact' : 'diff-forensics',
    outcome: i % 4 === 0 ? 'failure' : 'success',
  });
}
const partition = partitionTrainingRows(sampleRows);
assert.equal(partition.leakageOverlap, 0, 'golden benchmark must not leak into trainable data');
const goldenFingerprints = new Set(buildGoldenReplaySet(sampleRows).map((row) => row.fingerprint));
assert([...goldenFingerprints].every((fingerprint) => !partition.trainableRows.some((row) => row.fingerprint === fingerprint)));

const baseline = trainRepairBot({
  memory: {
    cases: sampleRows.map((row) => ({
      fingerprint: row.fingerprint,
      rootCause: row.rootCause,
      features: row.features,
      outcomes: [{ outcome: row.outcome, provenance: { strategyId: row.strategyId, failedSha: row.failedSha, targetSha: row.targetSha } }],
    })),
    antiLessons: [],
    actionHistory: [],
  },
  log: '',
});
assert.equal(baseline.trainingProvenance.goldenBenchmarkExcluded, true);

const lifecycle = derivePolicyLifecycle({
  policy: { byRootCause: {}, global: {} },
  baselineReport: { activePolicy: { byRootCause: {}, global: {} }, policy: { byRootCause: {}, global: {} }, trainingProvenance: { goldenBenchmarkExcluded: true } },
  antiForgetting: { status: 'REJECT_TRAINING', regression: true, comparable: true, candidate: { successAccuracy: 0, failureAvoidance: 0 } },
  goldenRows: [{ fingerprint: 'golden', outcome: 'success', strategyId: 'reproduce-exact' }],
});
assert.equal(lifecycle.status, 'ROLLBACK_TO_BASELINE');
assert.equal(lifecycle.routingEligible, false);
assert.equal(lifecycle.activePolicySource, 'BASELINE');

console.log('REPAIR_BOT_TRAINING_HARDENING=PASS');
