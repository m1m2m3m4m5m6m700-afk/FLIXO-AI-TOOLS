#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fingerprintCheckpoint } from './fingerprint.ts';
import { CheckpointStore } from './store.ts';

export const CHECKPOINT_CONTRACT = {
  id: 'CI-VERIFICATION-CHECKPOINT-001',
  version: 1,
  gate: 'CI',
  name: 'canonical verification checkpoint',
  dependencies: [],
  inputs: ['canonical certification evidence', 'execution identity'],
  outputs: ['stored verification checkpoint'],
  evaluator: 'CANONICAL_CERTIFY_ENGINE',
  scope: 'repository',
  severity: 'critical',
  execution: 'release',
  reusable: true,
  retry: 'never',
  freshness: 'dependency',
  escalation: { deep: false, full: true },
};

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/iu.test(String(value ?? ''))) throw new Error(`${label} must be a 40-character Git SHA`);
  return value;
}

function assertPass(certification) {
  if (certification?.status !== 'PASS') throw new Error(`Certification is not PASS: ${certification?.status ?? 'missing'}`);
  if (certification?.identityVerified !== true) throw new Error('Certification identityVerified must be true');
  assertSha(certification.certificationSha, 'certificationSha');
  if (!certification.runId) throw new Error('Certification runId is required');
}

export async function produceVerificationCheckpoint({ certification, identity, certificationPath, outputRoot }) {
  assertPass(certification);
  const commitSha = assertSha(identity?.commitSha, 'identity.commitSha');
  if (commitSha !== certification.certificationSha) {
    throw new Error(`Certification/checkpoint SHA mismatch: certification=${certification.certificationSha}; identity=${commitSha}`);
  }
  if (!identity.contractId) throw new Error('identity.contractId is required');
  if (!Number.isInteger(identity.contractVersion)) throw new Error('identity.contractVersion must be an integer');
  for (const key of ['inputHash', 'dependencyHash', 'lockfileHash', 'toolchainHash', 'configHash', 'ciConfigHash']) {
    if (!identity[key]) throw new Error(`identity.${key} is required`);
  }

  const fingerprint = fingerprintCheckpoint(
    { ...CHECKPOINT_CONTRACT, id: identity.contractId, version: identity.contractVersion },
    {
      commitSha,
      baseSha: identity.baseSha ?? commitSha,
      event: identity.event ?? 'pull_request',
      branch: identity.branch ?? 'main',
      repository: identity.repository ?? 'local',
      mode: identity.mode ?? 'RELEASE',
      toolchainFingerprint: identity.toolchainHash,
      lockfileHash: identity.lockfileHash,
      contractHash: identity.contractHash ?? 'checkpoint-contract',
      ciConfigHash: identity.ciConfigHash,
      configHash: identity.configHash,
      changedFiles: identity.changedFiles ?? [],
      affectedContracts: identity.affectedContracts ?? [],
      affectedRoutes: identity.affectedRoutes ?? [],
      affectedLocales: identity.affectedLocales ?? [],
      production: identity.production ?? false,
    },
    identity.inputHash,
    identity.dependencyHash,
  );

  const checkpoint = {
    schemaVersion: 1,
    identity: {
      commitSha,
      contractId: identity.contractId,
      contractVersion: identity.contractVersion,
      inputHash: identity.inputHash,
      dependencyHash: identity.dependencyHash,
      lockfileHash: identity.lockfileHash,
      toolchainHash: identity.toolchainHash,
      configHash: identity.configHash,
      ciConfigHash: identity.ciConfigHash,
    },
    fingerprint,
    result: {
      gate: 'CI',
      contract: identity.contractId,
      contractVersion: identity.contractVersion,
      status: 'PASS',
      severity: 'critical',
      scope: {},
      assertion: 'Canonical Certification PASS with verified execution identity',
      expected: { certificationSha: commitSha, identityVerified: true },
      actual: {
        certificationSha: certification.certificationSha,
        identityVerified: certification.identityVerified,
        workflowRunId: String(certification.runId),
      },
      evidence: [
        { source: 'canonical-certification', artifact: certificationPath ?? undefined },
        { source: 'canonical-certification', artifact: `workflow-run:${certification.runId}` },
      ],
    },
    evidencePath: certificationPath,
  };

  const store = new CheckpointStore(outputRoot);
  const storedPath = await store.save(checkpoint);
  if ((await store.reuse(fingerprint, checkpoint.identity))?.status !== 'PASS') {
    throw new Error('Persisted verification checkpoint failed immediate reuse validation');
  }
  return { checkpoint, path: storedPath };
}

async function main() {
  const [, , certificationPath, identityPath, outputRoot = 'artifacts/ci/checkpoints'] = process.argv;
  if (!certificationPath || !identityPath) throw new Error('Usage: produce-verification-checkpoint.mjs <certification.json> <identity.json> [output-root]');
  const certification = JSON.parse(await fs.readFile(certificationPath, 'utf8'));
  const identity = JSON.parse(await fs.readFile(identityPath, 'utf8'));
  const result = await produceVerificationCheckpoint({ certification, identity, certificationPath: path.normalize(certificationPath), outputRoot });
  console.log(`Verification checkpoint PASS: ${result.path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
