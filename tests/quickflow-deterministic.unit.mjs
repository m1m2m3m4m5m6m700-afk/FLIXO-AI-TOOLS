import assert from 'node:assert/strict';
import { buildQuickFlowPlan } from '../src/lib/quickflow.ts';
import { TOOL_REGISTRY } from '../src/config/registry.ts';

const cases = [
  ['compress image', [{ toolId: 'image-compressor', params: undefined }]],
  ['compress this image under 200KB', [{ toolId: 'image-compressor', params: { targetSizeKB: 200 } }]],
  ['prepare product image for store', [
    { toolId: 'background-remover', params: {} },
    { toolId: 'image-cropper', params: { aspectRatio: '1:1' } },
  ]],
];

for (const [input, expected] of cases) {
  const first = buildQuickFlowPlan(input, TOOL_REGISTRY);
  assert.ok(first, `QuickFlow returned no plan for: ${input}`);
  assert.deepEqual(first.steps.map(({ toolId, params }) => ({ toolId, params })), expected);
  const second = buildQuickFlowPlan(input, TOOL_REGISTRY);
  assert.deepEqual(second, first);
}

assert.equal(buildQuickFlowPlan('crop image', TOOL_REGISTRY), null);
assert.equal(buildQuickFlowPlan('   ', TOOL_REGISTRY), null);

console.log('QUICKFLOW_DETERMINISTIC_UNIT=PASS');
console.log('QUICKFLOW_AI_DEPENDENCY=NONE');
console.log('QUICKFLOW_INVALID_INPUT=FAIL_CLOSED');
console.log('QUICKFLOW_REPEATABILITY=PASS');
