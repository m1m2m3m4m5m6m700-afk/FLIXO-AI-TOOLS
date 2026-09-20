import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprintCheckpoint, isCheckpointIdentityValid } from './fingerprint.ts';
import { CheckpointStore } from './store.ts';
import { calculateInvalidation } from './invalidate.ts';

const contract = {
  id: 'CI-CHECK-001', version: 1, gate: 'TEST', name: 'checkpoint', dependencies: [], inputs: [], outputs: [], evaluator: 'test',
  scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency',
  escalation: { deep: true, full: true },
};
const context = {
  commitSha: 'abc', baseSha: 'base', event: 'test', branch: 'test', repository: 'repo', mode: 'L1',
  toolchainFingerprint: 'tool', lockfileHash: 'lock', contractHash: 'contract', ciConfigHash: 'ci', configHash: 'config',
  changedFiles: [], affectedContracts: [], affectedRoutes: [], affectedLocales: [], production: false,
};
const fingerprint = fingerprintCheckpoint(contract, context, 'input', 'dependency');
assert.equal(fingerprint.length, 64);
const identity = {
  commitSha: context.commitSha, contractId: contract.id, contractVersion: contract.version, inputHash: 'input', dependencyHash: 'dependency',
  lockfileHash: context.lockfileHash, toolchainHash: context.toolchainFingerprint, configHash: context.configHash, ciConfigHash: context.ciConfigHash,
};
assert.equal(isCheckpointIdentityValid(identity, { ...identity }), true);
assert.equal(isCheckpointIdentityValid(identity, { ...identity, inputHash: 'changed' }), false);

const root = await mkdtemp(join(tmpdir(), 'flixo-checkpoint-'));
const store = new CheckpointStore(root);
const checkpoint = { schemaVersion: 1, identity, fingerprint, result: { gate: 'TEST', contract: contract.id, contractVersion: 1, status: 'PASS', severity: 'critical', scope: {} } };
await store.save(checkpoint);
assert.equal((await store.reuse(fingerprint, identity))?.status, 'PASS');
assert.equal(await store.reuse(fingerprint, { ...identity, inputHash: 'changed' }), null);

const rules = [{ pattern: 'src/i18n/**', invalidates: ['CI-CHECK-001'], reason: 'localization changed' }];
const invalidated = calculateInvalidation(['src/i18n/ar.ts'], [contract], rules);
assert.deepEqual(invalidated.invalidatedContracts, ['CI-CHECK-001']);

console.log('CI checkpoint semantics PASS');
