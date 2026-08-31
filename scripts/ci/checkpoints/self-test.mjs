import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprintCheckpoint } from './fingerprint.ts';
import { CheckpointStore } from './store.ts';

const contract = {
  id: 'CI-CHECKPOINT-SELF-001', version: 1, gate: 'CI', name: 'checkpoint self-test', dependencies: [], inputs: [], outputs: [], evaluator: 'self-test',
  scope: 'repository', severity: 'critical', execution: 'unit', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
};
const context = {
  commitSha: process.env.GITHUB_SHA ?? 'LOCAL', baseSha: process.env.GITHUB_BASE_SHA ?? 'LOCAL', event: 'self-test', branch: 'local', repository: 'local', mode: 'L1',
  toolchainFingerprint: 'toolchain', lockfileHash: 'lock', contractHash: 'contract', ciConfigHash: 'ci', configHash: 'config',
  changedFiles: [], affectedContracts: [], affectedRoutes: [], affectedLocales: [], production: false,
};
const identity = {
  commitSha: context.commitSha, contractId: contract.id, contractVersion: 1, inputHash: 'input', dependencyHash: 'dependency',
  lockfileHash: context.lockfileHash, toolchainHash: context.toolchainFingerprint, configHash: context.configHash, ciConfigHash: context.ciConfigHash,
};
const fingerprint = fingerprintCheckpoint(contract, context, 'input', 'dependency');
const root = await mkdtemp(join(tmpdir(), 'flixo-checkpoint-self-'));
const store = new CheckpointStore(root);
await store.save({ schemaVersion: 1, identity, fingerprint, result: { gate: 'CI', contract: contract.id, contractVersion: 1, status: 'PASS', severity: 'critical', scope: {} } });
if ((await store.reuse(fingerprint, identity))?.status !== 'PASS') throw new Error('Checkpoint reuse failed');
if (await store.reuse(fingerprint, { ...identity, dependencyHash: 'invalid' })) throw new Error('Invalid checkpoint was reused');
console.log(`Checkpoint self-test PASS: ${fingerprint}`);
