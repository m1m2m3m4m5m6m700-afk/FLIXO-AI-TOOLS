import { createHash } from 'node:crypto';
import { z } from 'zod';

export const ADVICE_VAULT_PROTOCOL = 'FLIXO-ADVICE-VAULT-200K-v1' as const;
export const ADVICE_VAULT_CAPACITY = 200_000 as const;
export const ADVICE_VAULT_SHARD_SIZE = 10_000 as const;
export const ADVICE_VAULT_SHARD_COUNT = ADVICE_VAULT_CAPACITY / ADVICE_VAULT_SHARD_SIZE;
export const ADVICE_RETRIEVAL_CANDIDATE_LIMIT = 128 as const;

export const AdviceKindSchema = z.enum([
  'LESSON',
  'ANTI_LESSON',
  'RULE',
  'HEURISTIC',
  'PLAYBOOK_HINT',
]);

export const AdviceOutcomeSchema = z.enum([
  'SUCCESS',
  'FAILURE',
  'BLOCKED',
  'REVERTED',
  'UNKNOWN',
]);

export const AdviceEvidenceSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  targetSha: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  outcome: AdviceOutcomeSchema,
  source: z.string().min(1).max(2_000),
  at: z.string().datetime({ offset: true }),
}).strict();

export const AdviceRecordSchema = z.object({
  id: z.string().min(1).max(256),
  kind: AdviceKindSchema,
  content: z.string().trim().min(1).max(20_000),
  scope: z.string().trim().min(1).max(512),
  rootCause: z.string().trim().min(1).max(1_000).nullable(),
  action: z.string().trim().min(1).max(4_000).nullable(),
  applicability: z.array(z.string().trim().min(1).max(512)).max(32),
  contraindications: z.array(z.string().trim().min(1).max(512)).max(32),
  evidence: z.array(AdviceEvidenceSchema).min(1).max(128),
  confidence: z.number().finite().min(0).max(1),
  quality: z.number().finite().min(0).max(1),
  status: z.enum(['CURRENT', 'STALE', 'REVOKED']),
  executionAuthority: z.literal('ADVISORY_ONLY'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export type AdviceRecord = z.infer<typeof AdviceRecordSchema>;
export type AdviceOutcome = z.infer<typeof AdviceOutcomeSchema>;

export type AdvicePromotion = Readonly<{
  status: 'ADVISORY' | 'PLAYBOOK_CANDIDATE' | 'BLOCKED';
  distinctFailureFingerprints: number;
  attempts: number;
  successes: number;
  successRate: number;
  exactShaEvidence: boolean;
  reason: string;
}>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'fingerprint' && key !== 'createdAt' && key !== 'updatedAt')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function createAdviceFingerprint(input: Omit<AdviceRecord, 'fingerprint' | 'createdAt' | 'updatedAt'>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(input)), 'utf8').digest('hex');
}

export function validateAdviceRecord(value: unknown): AdviceRecord {
  return AdviceRecordSchema.parse(value);
}

export function normalizeAdviceRecord(
  input: Omit<AdviceRecord, 'fingerprint' | 'createdAt' | 'updatedAt'> & {
    fingerprint?: string;
    createdAt?: string;
    updatedAt?: string;
    now?: string;
  },
): AdviceRecord {
  const now = input.now ?? new Date().toISOString();
  const {
    fingerprint: suppliedFingerprint,
    createdAt: suppliedCreatedAt,
    updatedAt: suppliedUpdatedAt,
    now: _now,
    ...rest
  } = input;
  void _now;
  const fingerprint = createAdviceFingerprint(rest);
  if (suppliedFingerprint && suppliedFingerprint !== fingerprint) {
    throw new Error('ADVICE_FINGERPRINT_MISMATCH');
  }
  return validateAdviceRecord({
    ...rest,
    fingerprint,
    createdAt: suppliedCreatedAt ?? now,
    updatedAt: suppliedUpdatedAt ?? now,
  });
}

export function deduplicateAdvice(records: readonly AdviceRecord[]): AdviceRecord[] {
  const seen = new Map<string, AdviceRecord>();
  for (const record of records.map(validateAdviceRecord)) {
    const previous = seen.get(record.fingerprint);
    if (!previous || record.updatedAt > previous.updatedAt) seen.set(record.fingerprint, record);
  }
  return [...seen.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function detectAdviceConflicts(records: readonly AdviceRecord[]) {
  const groups = new Map<string, AdviceRecord[]>();
  for (const record of deduplicateAdvice(records)) {
    if (record.status !== 'CURRENT' || !record.rootCause) continue;
    const key = `${record.scope}|${record.rootCause}|${record.kind}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .flatMap(([key, group]) => {
      const actions = new Set(group.map((record) => record.action ?? record.content));
      return actions.size > 1 ? [{ key, records: group }] : [];
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function assertAdviceVaultCapacity(records: readonly AdviceRecord[]): AdviceRecord[] {
  const unique = deduplicateAdvice(records);
  if (unique.length > ADVICE_VAULT_CAPACITY) {
    throw new Error(`ADVICE_VAULT_CAPACITY_EXCEEDED:${unique.length}>${ADVICE_VAULT_CAPACITY}`);
  }
  return unique;
}

export function shardForAdvice(record: Pick<AdviceRecord, 'fingerprint'>): number {
  const value = Number.parseInt(record.fingerprint.slice(0, 8), 16);
  return value % ADVICE_VAULT_SHARD_COUNT;
}

export function partitionAdvice(records: readonly AdviceRecord[]) {
  const unique = assertAdviceVaultCapacity(records);
  const shards = Array.from({ length: ADVICE_VAULT_SHARD_COUNT }, () => [] as AdviceRecord[]);
  for (const record of unique) shards[shardForAdvice(record)].push(record);
  for (const shard of shards) {
    shard.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
    if (shard.length > ADVICE_VAULT_SHARD_SIZE) {
      throw new Error(`ADVICE_VAULT_SHARD_SKEW:${shard.length}>${ADVICE_VAULT_SHARD_SIZE}`);
    }
  }
  return shards;
}

export function evaluateAdvicePromotion(records: readonly AdviceRecord[]): AdvicePromotion {
  const unique = deduplicateAdvice(records);
  const usable = unique.filter((record) =>
    record.status === 'CURRENT' &&
    record.confidence >= 0.9 &&
    record.quality >= 0.8,
  );
  const evidence = usable.flatMap((record) => record.evidence);
  const distinctFailureFingerprints = new Set(evidence.map((item) => item.fingerprint)).size;
  const attempts = evidence.filter((item) => item.outcome !== 'UNKNOWN').length;
  const successes = evidence.filter((item) => item.outcome === 'SUCCESS').length;
  const successRate = attempts === 0 ? 0 : successes / attempts;
  const exactShaEvidence = evidence.some((item) => item.outcome === 'SUCCESS' && item.targetSha !== null);

  if (evidence.some((item) => item.outcome === 'REVERTED')) {
    return {
      status: 'BLOCKED',
      distinctFailureFingerprints,
      attempts,
      successes,
      successRate,
      exactShaEvidence,
      reason: 'Reverted evidence blocks blind promotion.',
    };
  }

  if (distinctFailureFingerprints >= 2 && attempts > 0 && successRate >= 0.8 && exactShaEvidence) {
    return {
      status: 'PLAYBOOK_CANDIDATE',
      distinctFailureFingerprints,
      attempts,
      successes,
      successRate,
      exactShaEvidence,
      reason: 'Repeated cross-fingerprint evidence satisfies the advisory promotion threshold; execution authority remains external.',
    };
  }

  return {
    status: 'ADVISORY',
    distinctFailureFingerprints,
    attempts,
    successes,
    successRate,
    exactShaEvidence,
    reason: 'Insufficient repeated verified evidence for playbook candidacy.',
  };
}

export function summarizeAdviceVault(records: readonly AdviceRecord[]) {
  const unique = assertAdviceVaultCapacity(records);
  const shards = partitionAdvice(unique);
  return Object.freeze({
    protocol: ADVICE_VAULT_PROTOCOL,
    capacity: ADVICE_VAULT_CAPACITY,
    materialized: unique.length,
    remaining: ADVICE_VAULT_CAPACITY - unique.length,
    shards: shards.length,
    maxShardSize: Math.max(0, ...shards.map((shard) => shard.length)),
    current: unique.filter((record) => record.status === 'CURRENT').length,
    revoked: unique.filter((record) => record.status === 'REVOKED').length,
    advisoryOnly: unique.every((record) => record.executionAuthority === 'ADVISORY_ONLY'),
  });
}
