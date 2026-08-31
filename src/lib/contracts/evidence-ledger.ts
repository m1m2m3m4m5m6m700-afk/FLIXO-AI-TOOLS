import type { ContractResult } from './ci-contracts';

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

export type EvidenceRecord = ContractResult & {
  readonly schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  readonly recordedAt: string;
  readonly commit: string;
  readonly contractVersion: string;
};

const COMMIT_SHA = /^[0-9a-f]{40}$/;

function assertIsoDateTime(value: string): void {
  if (!value.trim()) throw new Error('Evidence timestamp is required');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`Evidence timestamp must be canonical ISO-8601 UTC: ${value}`);
  }
}

function assertContractVersion(value: string, contract: string): void {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`Invalid contract version: ${contract}`);
  }
}

function assertScope(scope: ContractResult['scope']): void {
  const keys = Object.keys(scope);
  const allowed = new Set(['toolId', 'route', 'locale', 'file']);
  for (const key of keys) {
    if (!allowed.has(key)) throw new Error(`Invalid evidence scope field: ${key}`);
  }
}

export function createEvidenceRecord(
  result: ContractResult,
  metadata: Readonly<{ commit: string; contractVersion: string; recordedAt: string }>,
): EvidenceRecord {
  if (!result.gate.trim()) throw new Error(`Evidence gate is required: ${result.contract}`);
  if (!result.contract.trim()) throw new Error('Evidence contract is required');
  assertScope(result.scope);
  if (!COMMIT_SHA.test(metadata.commit)) {
    throw new Error(`Evidence commit must be a 40-character lowercase SHA: ${metadata.commit}`);
  }
  assertContractVersion(metadata.contractVersion, result.contract);
  assertIsoDateTime(metadata.recordedAt);
  return {
    ...result,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    recordedAt: metadata.recordedAt,
    commit: metadata.commit,
    contractVersion: metadata.contractVersion,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function serializeEvidence(record: EvidenceRecord): string {
  return `${JSON.stringify(canonicalize(record))}\n`;
}
