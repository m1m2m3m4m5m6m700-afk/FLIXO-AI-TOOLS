import assert from 'node:assert/strict';
import { extractParameters } from '../src/lib/agent/intent/parameter-extractor.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { safeParseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';

const combined = extractParameters('compress this image under 200KB and convert to WebP');
assert.equal(combined.success, true);
assert.deepEqual(combined.payload?.operations, [
  { capability: 'image-compressor', params: { targetSizeKB: 200, format: 'image/webp' } },
  { capability: 'image-converter', params: { format: 'image/webp' } },
]);

const combinedPlan = planFromIntent('compress this image under 200KB and convert to WebP');
assert.deepEqual(combinedPlan?.steps, [
  { toolId: 'image-compressor', params: { targetSizeKB: 200, format: 'image/webp' } },
  { toolId: 'image-converter', params: { format: 'image/webp' } },
]);

const dimensions = extractParameters('resize to 1200x800');
assert.equal(dimensions.success, true);
assert.deepEqual(dimensions.payload?.operations, [
  { capability: 'image-cropper', params: { width: 1200, height: 800, mode: 'exact' } },
]);

const ratio = extractParameters('aspect ratio 1:1');
assert.equal(ratio.success, true);
assert.deepEqual(ratio.payload?.operations, [
  { capability: 'image-cropper', params: { aspectRatio: '1:1' } },
]);

const brightness = extractParameters('increase brightness 10%');
assert.equal(brightness.success, true);
assert.deepEqual(brightness.payload?.operations, [
  { capability: 'image-effects', params: { brightness: 110 } },
]);

const arabic = extractParameters('اضغط الصورة إلى أقل من 200 كيلوبايت وحولها لـ WebP');
assert.equal(arabic.success, true);
assert.deepEqual(arabic.payload?.operations, [
  { capability: 'image-compressor', params: { targetSizeKB: 200, format: 'image/webp' } },
  { capability: 'image-converter', params: { format: 'image/webp' } },
]);

const oversize = extractParameters('resize to 5000x5000');
assert.equal(oversize.success, false);
assert.match(oversize.errors.join(' '), /pixel limit|invalid/i);
assert.equal(planFromIntent('resize to 5000x5000'), null);

const missingFormat = extractParameters('convert this image');
assert.equal(missingFormat.success, false);
assert.match(missingFormat.errors.join(' '), /target output format/i);
assert.equal(planFromIntent('convert this image'), null);

const unsupportedParameter = safeParseExecutionPlan({
  workflowName: 'Invalid Parameter',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { unsupportedObject: {} } }],
});
assert.equal(unsupportedParameter.success, false);

console.log('P1 structured parameter extraction contract tests passed.');
