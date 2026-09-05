import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvidenceManifest, EvidenceRecord } from './schema.ts';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validate(record: EvidenceRecord): void {
  if (record.schemaVersion !== 1) throw new Error('Unsupported evidence schema version');
  for (const field of ['gate', 'contract', 'source', 'commitSha', 'toolchainFingerprint', 'lockfileHash', 'contractHash', 'ciConfigHash', 'inputHash', 'evidenceId']) {
    if (!record[field]) throw new Error(`Missing evidence field: ${field}`);
  }
  if (!['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'].includes(record.status)) throw new Error(`Invalid evidence status: ${record.status}`);
  if (!Number.isInteger(record.contractVersion) || record.contractVersion < 1) throw new Error('Invalid contract version');
}

export function createEvidenceId(record: Omit<EvidenceRecord, 'evidenceId' | 'createdAt'>): string {
  return sha256(JSON.stringify(canonicalize(record)));
}

export async function writeEvidence(record: EvidenceRecord, root = 'artifacts/ci/evidence'): Promise<string> {
  validate(record);
  const path = join(root, `${record.evidenceId}.json`);
  await mkdir(root, { recursive: true });
  await writeFile(path, JSON.stringify(canonicalize(record), null, 2) + '\n', { flag: 'wx' });
  return path;
}

export async function writeManifest(manifest: Omit<EvidenceManifest, 'manifestHash'>, root = 'artifacts/ci/evidence'): Promise<string> {
  const manifestHash = sha256(JSON.stringify(canonicalize(manifest)));
  const output: EvidenceManifest = { ...manifest, manifestHash };
  const path = join(root, 'manifest.json');
  await mkdir(root, { recursive: true });
  await writeFile(path, JSON.stringify(canonicalize(output), null, 2) + '\n', { flag: 'wx' });
  return path;
}
