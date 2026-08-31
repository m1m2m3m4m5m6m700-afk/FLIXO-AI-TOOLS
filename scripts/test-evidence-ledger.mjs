import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTRACT_IDS, CONTRACT_VERSIONS } from '../src/lib/contracts/ci-contracts.ts';
import { createEvidenceRecord, serializeEvidence } from '../src/lib/contracts/evidence-ledger.ts';
import { buildEvidenceRecord, evidencePath, writeEvidence } from './evidence-ledger.mjs';

const result = {
  gate: 'G4',
  contract: CONTRACT_IDS.G4_TITLE_001,
  status: 'PASS',
  scope: { route: '/ar/image-compressor', locale: 'ar' },
  expected: 'عنوان عربي',
  actual: 'عنوان عربي',
};
const metadata = {
  commit: '0123456789abcdef0123456789abcdef01234567',
  contractVersion: String(CONTRACT_VERSIONS[result.contract]),
  recordedAt: '2026-08-31T00:00:00.000Z',
};

const record = buildEvidenceRecord(result, metadata);
if (record.schemaVersion !== 1) throw new Error('schemaVersion mismatch');
if (serializeEvidence(record) !== serializeEvidence(createEvidenceRecord(result, metadata))) {
  throw new Error('Evidence serialization is not deterministic');
}

for (const invalid of [
  { ...metadata, commit: 'short' },
  { ...metadata, contractVersion: '0' },
  { ...metadata, recordedAt: '2026-08-31T00:00:00Z' },
]) {
  let rejected = false;
  try {
    buildEvidenceRecord(result, invalid);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Invalid evidence metadata was accepted');
}

const root = await mkdtemp(join(tmpdir(), 'flixo-evidence-'));
try {
  const written = await writeEvidence(record, root);
  if (written !== evidencePath(root, record)) throw new Error('Evidence path mismatch');
  const restored = JSON.parse(await readFile(written, 'utf8'));
  if (serializeEvidence(restored) !== serializeEvidence(record)) {
    throw new Error('Persisted evidence is not byte-deterministic after parse');
  }
  if (restored.contract !== result.contract || restored.status !== result.status) {
    throw new Error('Persisted evidence mismatch');
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('Evidence ledger PASS');
