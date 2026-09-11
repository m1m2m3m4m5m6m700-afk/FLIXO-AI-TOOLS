#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { produceVerificationCheckpoint } from './produce-verification-checkpoint.mjs';

const sha = 'f9db9a4a14080a2cfe7853b7c20c2d4d15351607';
const identity = {
  commitSha: sha,
  contractId: 'CI-VERIFICATION-CHECKPOINT-001',
  contractVersion: 1,
  inputHash: 'input-hash',
  dependencyHash: 'dependency-hash',
  lockfileHash: 'lockfile-hash',
  toolchainHash: 'node22-npm11',
  configHash: 'config-hash',
  ciConfigHash: 'ci-config-hash',
  branch: 'phase-b/p1-checkpoint-producer',
  event: 'pull_request',
  repository: 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS',
};
const certification = {
  status: 'PASS',
  certificationSha: sha,
  runId: '34654891798',
  identityVerified: true,
};

const root = await mkdtemp(join(tmpdir(), 'flixo-verification-checkpoint-'));
const produced = await produceVerificationCheckpoint({
  certification,
  identity,
  certificationPath: 'artifacts/certification.json',
  outputRoot: root,
});

assert.match(produced.path, /[0-9a-f]{64}\.json$/iu);
assert.equal(produced.checkpoint.identity.commitSha, certification.certificationSha);
assert.equal(produced.checkpoint.result.status, 'PASS');
assert.equal(produced.checkpoint.result.actual.certificationSha, sha);
assert.equal(produced.checkpoint.result.actual.workflowRunId, certification.runId);

const stored = JSON.parse(await readFile(produced.path, 'utf8'));
assert.deepEqual(stored, produced.checkpoint);

await assert.rejects(
  () => produceVerificationCheckpoint({
    certification,
    identity: { ...identity, commitSha: '0000000000000000000000000000000000000000' },
    outputRoot: root,
  }),
  /SHA mismatch/iu,
);

await assert.rejects(
  () => produceVerificationCheckpoint({
    certification: { ...certification, identityVerified: false },
    identity,
    outputRoot: root,
  }),
  /identityVerified must be true/iu,
);

console.log('Verification checkpoint producer PASS');
