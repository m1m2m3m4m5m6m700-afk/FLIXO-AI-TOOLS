import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOutput, suiteContract, ultraContractHash, ULTRA_SCHEMA_VERSION, ULTRA_SUITE_NAMES } from './ultra-contract.mjs';
import { classifyFailure } from './failure/taxonomy.ts';

test('Ultra contract is deterministic and complete', () => {
  assert.equal(ULTRA_SCHEMA_VERSION, 3);
  assert.deepEqual(ULTRA_SUITE_NAMES, ['toolchain', 'architecture', 'localization', 'seo', 'security', 'artifact', 'runtime', 'browser', 'build']);
  assert.equal(typeof ultraContractHash(), 'string');
  assert.equal(ultraContractHash().length, 64);
  for (const suite of ULTRA_SUITE_NAMES) assert.ok(suiteContract(suite).length > 0, suite);
});

test('Ultra signature normalization removes volatile identifiers', () => {
  const a = normalizeOutput('canonical https://example.test/a sha deadbeef1234567 count 17');
  const b = normalizeOutput('canonical https://other.test/b sha aabbccddeeff001 count 42');
  assert.equal(a, b);
});

test('Ultra delegates failure classification to the official taxonomy', () => {
  const failure = classifyFailure({
    id: 'deployment',
    contract: 'CI-DEPLOY-001',
    status: 'FAIL',
    message: 'deployment rate limit api-deployments-free-per-day',
  });
  assert.equal(failure.classification, 'INFRASTRUCTURE_ERROR');
  assert.equal(failure.rootCauseId, 'RC-INFRA-001');
});
