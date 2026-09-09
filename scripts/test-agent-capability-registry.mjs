import assert from 'node:assert/strict';
import { IMAGE_TOOLS } from '../src/config/tool-definitions/image.ts';
import { CAPABILITY_REGISTRY, getCapability, getExecutableCapabilityIds, validateCapabilityParameters } from '../src/lib/agent/capability-registry.ts';
import { EXECUTABLE_PIPELINE_TOOL_IDS } from '../src/lib/workflows/executable-tools.ts';
import { safeParseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';

assert.equal(CAPABILITY_REGISTRY.length, IMAGE_TOOLS.length, 'Every configured image tool must have a capability contract.');
assert.equal(CAPABILITY_REGISTRY.length, 21, 'Current image capability inventory must contain 21 mapped tools.');

for (const tool of IMAGE_TOOLS) {
  const capability = getCapability(tool.id);
  assert.ok(capability, `Missing capability contract: ${tool.id}`);
  assert.equal(capability?.state === 'UNAVAILABLE', !tool.isReady, `Readiness/state drift: ${tool.id}`);
}

assert.deepEqual(
  [...getExecutableCapabilityIds()].sort(),
  [...EXECUTABLE_PIPELINE_TOOL_IDS].sort(),
  'Executable capability registry and pipeline executor allowlist have drifted.',
);

assert.equal(getCapability('photo-colorizer')?.state, 'UNAVAILABLE');
assert.throws(() => validateCapabilityParameters('photo-colorizer', {}), /not executable/);
assert.deepEqual(validateCapabilityParameters('image-compressor', { quality: 0.8 }), { quality: 0.8 });

const valid = safeParseExecutionPlan({
  workflowName: 'Direct Tool',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { quality: 0.8 } }],
});
assert.equal(valid.success, true);

const unavailable = safeParseExecutionPlan({
  workflowName: 'Unavailable',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { unsupportedObject: {} } }],
});
assert.equal(unavailable.success, false);

console.log(`Agent capability contract tests passed: ${CAPABILITY_REGISTRY.length} capabilities mapped.`);
