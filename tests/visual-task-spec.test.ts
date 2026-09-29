import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { compileVisualTaskSpec } from '../src/lib/agent/visual-task-spec.ts';

test('visual task spec preserves explicit critical constraints', () => {
  const plan = planFromIntent('remove the background and keep the face unchanged');
  assert.ok(plan);
  const spec = compileVisualTaskSpec('remove the background and keep the face unchanged', plan);
  assert.ok(spec);
  assert.equal(spec?.source, 'DETERMINISTIC');
  assert.equal(spec?.quality.preserveSubject, true);
  assert.equal(spec?.constraints.some((item) => item.priority === 'CRITICAL'), true);
  assert.deepEqual(spec?.operations.map((item) => item.capabilityId), ['background-remover']);
});

test('visual task spec mirrors multi-step canonical plan', () => {
  const plan = planFromIntent('prepare a product image for a shop, square');
  assert.ok(plan);
  const spec = compileVisualTaskSpec('prepare a product image for a shop, square', plan);
  assert.ok(spec);
  assert.deepEqual(spec?.operations.map((item) => item.capabilityId), ['background-remover', 'image-cropper']);
});
