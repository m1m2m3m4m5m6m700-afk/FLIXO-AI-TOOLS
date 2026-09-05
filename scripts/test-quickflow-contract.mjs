import assert from 'node:assert/strict';
import { buildQuickFlowPlan } from '../src/lib/quickflow.ts';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';

const compress = buildQuickFlowPlan('compress image', TOOLS_REGISTRY);
assert.equal(compress?.version, 1);
assert.deepEqual(compress?.steps.map((step) => step.toolId), ['image-compressor']);

const arabic = buildQuickFlowPlan('إزالة الخلفية', TOOLS_REGISTRY);
assert.deepEqual(arabic?.steps.map((step) => step.toolId), ['background-remover']);

const unknown = buildQuickFlowPlan('do something unrelated', TOOLS_REGISTRY);
assert.equal(unknown, null);

const empty = buildQuickFlowPlan('   ', TOOLS_REGISTRY);
assert.equal(empty, null);

const notReadyTools = TOOLS_REGISTRY.map((tool) =>
  tool.id === 'image-compressor' ? { ...tool, isReady: false } : tool,
);
assert.equal(buildQuickFlowPlan('compress image', notReadyTools), null);

console.log('QuickFlow contract tests passed.');
