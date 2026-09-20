import assert from 'node:assert/strict';
import { buildIntentPlan } from '../src/lib/agent/intent/intent-plan.ts';
import { guardIntentPlan } from '../src/lib/agent/intent/plan-guard.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';

const ready = buildIntentPlan('compress this image under 200KB and convert to WebP');
assert.equal(ready.status, 'READY');
assert.equal(ready.confirmationRequired, true);
assert.deepEqual(ready.steps, [
  { toolId: 'image-converter', params: { format: 'image/webp' } },
  { toolId: 'image-compressor', params: { targetSizeKB: 200 } },
]);
assert.equal(ready.missing.length, 0);
assert.equal(guardIntentPlan(ready).ok, true);

const missingFormat = buildIntentPlan('convert this image');
assert.equal(missingFormat.status, 'NEEDS_INPUT');
assert.equal(missingFormat.confirmationRequired, false);
assert.equal(missingFormat.missing[0]?.id, 'output-format');

const missingCrop = buildIntentPlan('crop this image');
assert.equal(missingCrop.status, 'NEEDS_INPUT');
assert.equal(missingCrop.missing[0]?.id, 'crop-geometry');

const arabic = buildIntentPlan('اضغط الصورة إلى أقل من 200 كيلوبايت وحولها لـ WebP');
assert.equal(arabic.status, 'READY');
assert.deepEqual(arabic.steps.map((step) => step.toolId), ['image-converter', 'image-compressor']);

const unsupported = buildIntentPlan('قم بتحرير الصورة بطريقة غير محددة');
assert.equal(unsupported.status, 'NEEDS_INPUT');

const projected = planFromIntent('remove background and make the image square');
assert.deepEqual(projected?.steps.map((step) => step.toolId), ['background-remover', 'image-cropper']);

console.log('IntentPlan / Missing-Info / Plan-Guard contract tests passed.');
