import { createEvidenceId, writeEvidence, writeManifest } from './ledger.ts';

const base = {
  schemaVersion: 1,
  gate: 'CI',
  contract: 'CI-EVIDENCE-SELF-001',
  contractVersion: 1,
  status: 'PASS',
  scope: { file: 'scripts/ci/evidence' },
  assertion: 'Evidence record is complete and immutable',
  source: 'ci-evidence-self-test',
  commitSha: process.env.GITHUB_SHA ?? 'LOCAL',
  toolchainFingerprint: process.env.CI_TOOLCHAIN_FINGERPRINT ?? 'LOCAL',
  lockfileHash: process.env.CI_LOCKFILE_HASH ?? 'LOCAL',
  contractHash: process.env.CI_CONTRACT_HASH ?? 'LOCAL',
  ciConfigHash: process.env.CI_CONFIG_HASH ?? 'LOCAL',
  inputHash: 'self-test-input',
};

const evidenceId = createEvidenceId(base);
const record = { ...base, evidenceId, createdAt: new Date().toISOString() };
const path = await writeEvidence(record);
await writeManifest({
  schemaVersion: 1,
  commitSha: record.commitSha,
  contractHash: record.contractHash,
  ciConfigHash: record.ciConfigHash,
  entries: [{ evidenceId, contract: record.contract, status: record.status, scope: record.scope, path, sha256: evidenceId }],
});
console.log(`Evidence ledger PASS: ${evidenceId}`);
