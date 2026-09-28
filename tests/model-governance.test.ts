import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canFallbackTo,
  evaluateModelAdmission,
  isProductionEligible,
  modelIdentity,
  quarantineModel,
  type ModelManifestEntry,
} from '../src/lib/agent/model-governance.ts';

const base = (): ModelManifestEntry => ({
  model: 'example/model',
  version: '1.0.0',
  source: 'https://example.invalid/model',
  license: 'Apache-2.0',
  license_file: 'LICENSE',
  artifact_sha256: 'a'.repeat(64),
  download_date: '2026-09-28',
  commercial_use: 'PASS',
  fine_tuning: 'PASS',
  redistribution: 'PASS',
  distillation: 'PASS',
  adapter_policy: 'PASS',
  acceptable_use_policy: 'PASS',
  trademark_restrictions: 'PASS',
  training_data_restrictions: 'PASS',
  provenance_status: 'PASS',
  FLIXO_owned_layer: 'FLIXO adapter only; base remains third-party',
  fallback_models: ['fallback/model@2.0.0'],
  review_status: 'PASS',
  lifecycle_status: 'ACTIVE',
});

test('model admission is fail-closed for unknown, review, blocked and bad artifacts', () => {
  assert.equal(evaluateModelAdmission(base()), 'PASS');

  const unknown = { ...base(), provenance_status: 'UNKNOWN' as const };
  assert.equal(evaluateModelAdmission(unknown), 'UNKNOWN');

  const review = { ...base(), adapter_policy: 'REVIEW_REQUIRED' as const };
  assert.equal(evaluateModelAdmission(review), 'REVIEW_REQUIRED');

  const blocked = { ...base(), redistribution: 'BLOCKED' as const };
  assert.equal(evaluateModelAdmission(blocked), 'BLOCKED');

  const badHash = { ...base(), artifact_sha256: 'not-a-sha' };
  assert.equal(evaluateModelAdmission(badHash), 'BLOCKED');
});

test('production eligibility requires both PASS admission and ACTIVE lifecycle', () => {
  assert.equal(isProductionEligible(base()), true);
  assert.equal(isProductionEligible({ ...base(), lifecycle_status: 'APPROVED' }), false);
  assert.equal(isProductionEligible({ ...base(), review_status: 'REVIEW_REQUIRED' }), false);
});

test('quarantine is an explicit replacement-safe state transition', () => {
  const quarantined = quarantineModel(base());
  assert.equal(quarantined.lifecycle_status, 'QUARANTINED');
  assert.equal(quarantined.review_status, 'REVIEW_REQUIRED');
  assert.equal(isProductionEligible(quarantined), false);
});

test('fallback requires explicit registry identity and production eligibility', () => {
  const primary = base();
  const fallback = {
    ...base(),
    model: 'fallback/model',
    version: '2.0.0',
    fallback_models: [],
  };
  assert.equal(modelIdentity(fallback), 'fallback/model@2.0.0');
  assert.equal(canFallbackTo(primary, fallback), true);
  assert.equal(canFallbackTo(primary, { ...fallback, lifecycle_status: 'QUARANTINED' }), false);
  assert.equal(canFallbackTo(primary, { ...fallback, version: '3.0.0' }), false);
});


test('unregistered model selections fail closed', async () => {
  const { admitModelSelection, assertModelSelectionAdmitted, listRegisteredModels } = await import('../src/lib/agent/model-registry.ts');
  assert.equal(listRegisteredModels().length, 0);
  assert.deepEqual(admitModelSelection({ model: 'unregistered/model' }), {
    identity: 'unregistered/model',
    status: 'BLOCKED',
    lifecycle: 'UNREGISTERED',
    eligible: false,
  });
  assert.throws(
    () => assertModelSelectionAdmitted({ model: 'unregistered/model' }),
    /MODEL_NOT_ADMITTED:unregistered\/model:BLOCKED/,
  );
});
