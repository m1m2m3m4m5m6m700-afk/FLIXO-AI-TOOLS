import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEvidenceId, writeEvidence, writeManifest } from './ledger.ts';

const root = await mkdtemp(join(tmpdir(), 'flixo-evidence-'));
const base = {
  schemaVersion: 1,
  gate: 'TEST',
  contract: 'CI-EVIDENCE-001',
  contractVersion: 1,
  status: 'PASS',
  scope: { route: '/test' },
  source: 'ledger-test',
  commitSha: 'abc',
  toolchainFingerprint: 'toolchain',
  lockfileHash: 'lock',
  contractHash: 'contract',
  ciConfigHash: 'config',
  inputHash: 'input',
};

const evidenceId = createEvidenceId(base);
assert.equal(evidenceId.length, 64);
const record = { ...base, evidenceId, createdAt: '2026-01-01T00:00:00.000Z' };
const path = await writeEvidence(record, root);
assert.equal(JSON.parse(await readFile(path, 'utf8')).evidenceId, evidenceId);
await assert.rejects(() => writeEvidence(record, root));

const manifest = {
  schemaVersion: 1,
  commitSha: 'abc',
  contractHash: 'contract',
  ciConfigHash: 'config',
  entries: [{ evidenceId, contract: record.contract, status: 'PASS', scope: record.scope, path, sha256: evidenceId }],
};
const manifestPath = await writeManifest(manifest, root);
const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(parsed.manifestHash.length, 64);

console.log('Evidence ledger semantics PASS');
