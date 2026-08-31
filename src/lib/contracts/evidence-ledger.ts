import type { ContractResult } from './ci-contracts';

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

export type EvidenceRecord = ContractResult & {
  readonly schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  readonly recordedAt: string;
  readonly commit: string;
  readonly contractVersion: string;
};

export function createEvidenceRecord(
  result: ContractResult,
  metadata: Readonly<{ commit: string; contractVersion: string; recordedAt: string }>,
): EvidenceRecord {
  if (!metadata.commit.trim()) throw new Error('Evidence commit is required');
  if (!metadata.contractVersion.trim()) throw new Error(`Contract version is required: ${result.contract}`);
  if (!metadata.recordedAt.trim()) throw new Error(`Evidence timestamp is required: ${result.contract}`);
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
