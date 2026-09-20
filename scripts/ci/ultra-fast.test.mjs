import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ultraContractHash, ULTRA_SCHEMA_VERSION } from './ultra-contract.mjs';

test('Ultra Fast uses the shared Ultra contract identity', () => {
  assert.equal(typeof ULTRA_SCHEMA_VERSION, 'number');
  assert.equal(typeof ultraContractHash(), 'string');
  assert.equal(ultraContractHash().length, 64);
});

test('Ultra Fast defines bounded triage checks and fail-closed evidence', () => {
  const source = readFileSync(new URL('./ultra-fast.mjs', import.meta.url), 'utf8');
  for (const marker of [
    'CI-ULTRA-FAST-001',
    'CI-TOOLCHAIN-001',
    'CI-CONFIG-001',
    'G1-REGISTRY-001',
    'G1-ROUTER-001',
    'timeoutMs',
    'failureIntelligence',
    "status: report.status === 'PASS' ? 0 : 1",
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
});
