import assert from 'node:assert/strict';
import { extractParameters } from '../src/lib/agent/intent/parameter-extractor.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { safeParseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { getCapability, getExecutableCapabilityIds } from '../src/lib/agent/capability-registry.ts';

const combined = extractParameters('compress this image under 200KB and convert to WebP');
assert.equal(combined.success, true);
assert.deepEqual(combined.payload?.operations, [
  { capability: 'image-compressor', params: { targetSizeKB: 200 } },
  { capability: 'image-converter', params: { format: 'image/webp' } },
]);

const combinedPlan = planFromIntent('compress this image under 200KB and convert to WebP');
assert.deepEqual(combinedPlan?.steps, [
  { toolId: 'image-converter', params: { format: 'image/webp' } },
  { toolId: 'image-compressor', params: { targetSizeKB: 200 } },
]);

assert.equal(combinedPlan?.catalogFingerprint, TOOL_CATALOG.fingerprint);

const productPlan = planFromIntent('جهز صورة المنتج للمتجر بأقل من 200KB وصيغة WebP');
assert.deepEqual(productPlan?.steps, [
  { toolId: 'background-remover', params: {} },
  { toolId: 'image-cropper', params: { aspectRatio: '1:1' } },
  { toolId: 'image-converter', params: { format: 'image/webp' } },
  { toolId: 'image-compressor', params: { targetSizeKB: 200 } },
]);

const dimensions = extractParameters('resize to 1200x800');
assert.equal(dimensions.success, true);
assert.deepEqual(dimensions.payload?.operations, [{ capability: 'image-cropper', params: { width: 1200, height: 800, mode: 'exact' } }]);

const ratio = extractParameters('aspect ratio 1:1');
assert.equal(ratio.success, true);
assert.deepEqual(ratio.payload?.operations, [{ capability: 'image-cropper', params: { aspectRatio: '1:1' } }]);

const brightness = extractParameters('increase brightness 10%');
assert.equal(brightness.success, true);
assert.deepEqual(brightness.payload?.operations, [{ capability: 'image-effects', params: { brightness: 110 } }]);

const arabic = extractParameters('اضغط الصورة إلى أقل من 200 كيلوبايت وحولها لـ WebP');
assert.equal(arabic.success, true);
assert.deepEqual(arabic.payload?.operations, [
  { capability: 'image-compressor', params: { targetSizeKB: 200 } },
  { capability: 'image-converter', params: { format: 'image/webp' } },
]);

const oversize = extractParameters('resize to 5000x5000');
assert.equal(oversize.success, false);
assert.match(oversize.errors.join(' '), /canonical schema validation|maximum 4000|pixel limit|invalid/i);
assert.equal(planFromIntent('resize to 5000x5000'), null);

const missingFormat = extractParameters('convert this image');
assert.equal(missingFormat.success, false);
assert.match(missingFormat.errors.join(' '), /target output format/i);
assert.equal(planFromIntent('convert this image'), null);

const stalePlan = safeParseExecutionPlan({
  workflowName: 'Stale Plan',
  confidence: 0.9,
  catalogFingerprint: '0'.repeat(64),
  steps: [{ toolId: 'image-compressor', params: { quality: 0.8 } }],
});
assert.equal(stalePlan.success, false);

const unboundPlan = safeParseExecutionPlan({
  workflowName: 'Unbound Plan',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { quality: 0.8 } }],
});
assert.equal(unboundPlan.success, false);

const unsupportedParameter = safeParseExecutionPlan({
  workflowName: 'Invalid Parameter',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { unsupportedObject: {} } }],
});
assert.equal(unsupportedParameter.success, false);


const expectedMvpExecutableIds = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
].sort();
assert.deepEqual([...getExecutableCapabilityIds()].sort(), expectedMvpExecutableIds);
for (const capabilityId of expectedMvpExecutableIds) {
  assert.equal(getCapability(capabilityId)?.state, 'EXECUTABLE');
}

const naturalLanguageMatrix = [
  ['remove the background', 'background-remover', {}],
  ['upscale this image 2x', 'image-upscaler', { scale: 2 }],
  ['resize to 1200x800', 'image-cropper', { width: 1200, height: 800, mode: 'exact' }],
  ['compress this image under 200KB', 'image-compressor', { targetSizeKB: 200 }],
  ['convert this image to WebP', 'image-converter', { format: 'image/webp' }],
  ['increase contrast 15%', 'image-effects', { contrast: 115 }],
  ['ارفع الدقة 2x', 'image-upscaler', { scale: 2 }],
  ['زِد التشبع 20%', 'image-effects', { saturate: 120 }],
  ['اجعل الصورة أبيض وأسود', 'image-effects', { grayscale: 100 }],
];

for (const [input, capability, params] of naturalLanguageMatrix) {
  const extraction = extractParameters(input);
  assert.equal(extraction.success, true, `MVP intent extraction failed: ${input}`);
  assert.deepEqual(extraction.payload?.operations, [{ capability, params }]);
  const plan = planFromIntent(input);
  assert.deepEqual(plan?.steps, [{ toolId: capability, params }]);
}

const compoundMvp = planFromIntent('upscale this image 2x, increase contrast 10%, convert to WebP');
assert.deepEqual(compoundMvp?.steps, [
  { toolId: 'image-upscaler', params: { scale: 2 } },
  { toolId: 'image-effects', params: { contrast: 110 } },
  { toolId: 'image-converter', params: { format: 'image/webp' } },
]);

console.log('P1.2 dynamic QuickFlow planner contract tests passed.');
console.log('MVP-003_EXECUTABLE_SCOPE=6');
console.log('MVP-004_NATURAL_LANGUAGE_MATRIX=PASS');
