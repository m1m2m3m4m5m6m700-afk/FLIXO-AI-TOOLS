import assert from 'node:assert/strict';
import {
  ADVICE_VAULT_CAPACITY,
  ADVICE_VAULT_SHARD_COUNT,
  ADVICE_VAULT_SHARD_SIZE,
  assertAdviceVaultCapacity,
  detectAdviceConflicts,
  evaluateAdvicePromotion,
  normalizeAdviceRecord,
  partitionAdvice,
  shardForAdvice,
  summarizeAdviceVault,
} from '../src/lib/agent/knowledge/advice-vault.ts';

const now = '2026-09-21T00:00:00+00:00';
const make = (id, content, outcome, failureFingerprint, targetSha) => normalizeAdviceRecord({
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
  now,
});

const a = make('a', 'Use evidence before mutation.', 'SUCCESS', '1'.repeat(64), '2'.repeat(40));
const b = make('b', 'Use evidence before mutation.', 'SUCCESS', '3'.repeat(64), '4'.repeat(40));
const duplicate = {...a};
const conflict = normalizeAdviceRecord({
  ...a,
  id: 'conflict',
  content: 'Skip evidence before mutation.',
  action: 'mutate immediately',
  now,
});

assert.equal(a.executionAuthority, 'ADVISORY_ONLY');
assert.equal(ADVICE_VAULT_CAPACITY, 1_000_000);
assert.equal(ADVICE_VAULT_SHARD_SIZE, 10_000);
assert.equal(ADVICE_VAULT_SHARD_COUNT, 100);
assert.equal(assertAdviceVaultCapacity([a, duplicate]).length, 1);
assert.equal(partitionAdvice([a, b]).reduce((sum, shard) => sum + shard.length, 0), 2);
assert.equal(new Set(partitionAdvice([a, b]).flat().map(shardForAdvice)).size, 2);
assert.equal(detectAdviceConflicts([a, conflict]).length, 1);

const promotion = evaluateAdvicePromotion([a, b]);
assert.equal(promotion.status, 'PLAYBOOK_CANDIDATE');
assert.equal(promotion.distinctFailureFingerprints, 2);
assert.equal(promotion.successRate, 1);
assert.equal(promotion.exactShaEvidence, true);

assert.throws(() => assertAdviceVaultCapacity(new Array(ADVICE_VAULT_CAPACITY + 1)), /ADVICE_VAULT_CAPACITY_EXCEEDED/u);

const reverted = make('reverted', 'Use evidence before mutation.', 'REVERTED', '5'.repeat(64), '6'.repeat(40));
assert.equal(evaluateAdvicePromotion([a, b, reverted]).status, 'BLOCKED');

const summary = summarizeAdviceVault([a, b]);
assert.equal(summary.protocol, 'FLIXO-ADVICE-VAULT-1M-v1');
assert.equal(summary.capacity, 1_000_000);
assert.equal(summary.materialized, 2);
assert.equal(summary.remaining, 999_998);
assert.equal(summary.shards, 100);
assert.equal(summary.shardSize, 10_000);
assert.equal(summary.advisoryOnly, true);

console.log('Agent knowledge 1M vault tests passed.');
