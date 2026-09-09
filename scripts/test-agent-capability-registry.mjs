import assert from 'node:assert/strict';
import { IMAGE_TOOLS } from '../src/config/tool-definitions/image.ts';
import { CAPABILITY_REGISTRY, getCapability, getExecutableCapabilityIds, validateCapabilityParameters } from '../src/lib/agent/capability-registry.ts';
import { EXECUTABLE_PIPELINE_TOOL_IDS } from '../src/lib/workflows/executable-tools.ts';
import { safeParseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';

assert.equal(CAPABILITY_REGISTRY.length, IMAGE_TOOLS.length, 'Every configured image tool must have a capability contract.');
assert.equal(CAPABILITY_REGISTRY.length, IMAGE_TOOLS.length, `Capability inventory must match current image tool inventory (${IMAGE_TOOLS.length}).`);
assert.equal(IMAGE_TOOLS.filter((tool) => tool.isReady).length, 21, 'Current image registry must contain 21 ready tools.');
assert.equal(IMAGE_TOOLS.filter((tool) => !tool.isReady).length, 1, 'Current image registry must contain 1 non-ready tool.');

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

const invalidParameters = safeParseExecutionPlan({
  workflowName: 'Invalid Parameters',
  confidence: 0.9,
  steps: [{ toolId: 'image-compressor', params: { unsupportedObject: {} } }],
});
assert.equal(invalidParameters.success, false);

console.log(`Agent capability contract tests passed: ${CAPABILITY_REGISTRY.length} capabilities mapped (${IMAGE_TOOLS.filter((tool) => tool.isReady).length} ready, ${IMAGE_TOOLS.filter((tool) => !tool.isReady).length} unavailable).`);
