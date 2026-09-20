import assert from 'node:assert/strict';
import { buildQuickFlowPlan } from '../src/lib/quickflow.ts';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';

const compress = buildQuickFlowPlan('compress image', TOOLS_REGISTRY);
assert.equal(compress?.version, 2);
assert.deepEqual(compress?.steps.map((step) => step.toolId), ['image-compressor']);

const arabic = buildQuickFlowPlan('إزالة الخلفية', TOOLS_REGISTRY);
assert.deepEqual(arabic?.steps.map((step) => step.toolId), ['background-remover']);

const productPreset = buildQuickFlowPlan('prepare product image for store', TOOLS_REGISTRY);
assert.deepEqual(productPreset?.steps.map((step) => step.toolId), ['background-remover', 'image-cropper']);
assert.deepEqual(productPreset?.steps.map((step) => step.params), [{}, { aspectRatio: '1:1' }]);

const composite = buildQuickFlowPlan('جهز صورة المنتج للمتجر بأقل من 200KB وصيغة WebP', TOOLS_REGISTRY);
assert.deepEqual(composite?.steps.map((step) => step.toolId), ['background-remover', 'image-cropper', 'image-converter', 'image-compressor']);
assert.deepEqual(composite?.steps.map((step) => step.params), [{}, { aspectRatio: '1:1' }, { format: 'image/webp' }, { targetSizeKB: 200 }]);

const unknown = buildQuickFlowPlan('do something unrelated', TOOLS_REGISTRY);
assert.equal(unknown, null);

const empty = buildQuickFlowPlan('   ', TOOLS_REGISTRY);
assert.equal(empty, null);

const invalid = buildQuickFlowPlan('resize to 5000x5000', TOOLS_REGISTRY);
assert.equal(invalid, null);

const notReadyTools = TOOLS_REGISTRY.map((tool) => tool.id === 'image-compressor' ? { ...tool, isReady: false } : tool);
assert.equal(buildQuickFlowPlan('compress image', notReadyTools), null);

console.log('Dynamic QuickFlow contract tests passed.');
