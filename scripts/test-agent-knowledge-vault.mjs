import assert from 'node:assert/strict';
import {
  ADVICE_VAULT_CAPACITY,
  ADVICE_VAULT_SHARD_COUNT,
  assertAdviceVaultCapacity,
  detectAdviceConflicts,
  evaluateAdvicePromotion,
  normalizeAdviceRecord,
  partitionAdvice,
  shardForAdvice,
  summarizeAdviceVault,
} from '../src/lib/agent/knowledge/advice-vault.ts';

const now = '2026-09-21T00:00:00+00:00';
const make = (id, content, fingerprint, outcome, failureFingerprint, targetSha) => normalizeAdviceRecord({
  id,
  kind: 'LESSON',
  content,
  scope: 'auto-repair:example',
  rootCause: 'example-root-cause',
  action: 'apply bounded repair',
  applicability: ['same root cause'],
  contraindications: ['different root cause'],
  evidence: [{
    fingerprint: failureFingerprint,
    targetSha,
    outcome,
    source: 'test',
    at: now,
  }],
  confidence: 0.99,
  quality: 0.95,
  status: 'CURRENT',
  executionAuthority: 'ADVISORY_ONLY',
  fingerprint,
  now,
});

const a = make('a', 'Use evidence before mutation.', 'a'.repeat(64), 'SUCCESS', '1'.repeat(64), '2'.repeat(40));
const b = make('b', 'Use evidence before mutation.', 'b'.repeat(64), 'SUCCESS', '3'.repeat(64), '4'.repeat(40));
const duplicate = {...a};
const conflict = normalizeAdviceRecord({
  ...a,
  id: 'conflict',
  content: 'Skip evidence before mutation.',
  action: 'mutate immediately',
  fingerprint: undefined,
  now,
});

assert.equal(a.executionAuthority, 'ADVISORY_ONLY');
assert.equal(assertAdviceVaultCapacity([a, duplicate]).length, 1);
assert.equal(partitionAdvice([a, b]).reduce((sum, shard) => sum + shard.length, 0), 2);
assert.equal(new Set(partitionAdvice([a, b]).flat().map(shardForAdvice)).size, 2);
assert.equal(detectAdviceConflicts([a, conflict]).length, 1);

const promotion = evaluateAdvicePromotion([a, b]);
assert.equal(promotion.status, 'PLAYBOOK_CANDIDATE');
assert.equal(promotion.distinctFailureFingerprints, 2);
assert.equal(promotion.successRate, 1);
assert.equal(promotion.exactShaEvidence, true);

assert.throws(
  () => assertAdviceVaultCapacity(Array.from({length: ADVICE_VAULT_CAPACITY + 1}, (_, i) => ({
    ...a,
    id: `overflow-${i}`,
    fingerprint: i.toString(16).padStart(64, '0'),
  }))),
  /ADVICE_VAULT_CAPACITY_EXCEEDED/u,
);

const summary = summarizeAdviceVault([a, b]);
assert.equal(summary.capacity, 200_000);
assert.equal(summary.materialized, 2);
assert.equal(summary.remaining, 199_998);
assert.equal(summary.shards, ADVICE_VAULT_SHARD_COUNT);
assert.equal(summary.advisoryOnly, true);

console.log('Agent knowledge 200K vault tests passed.');
