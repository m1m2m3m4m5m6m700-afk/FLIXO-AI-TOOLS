import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS } from '../src/config/canonical-tool-definition.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { CAPABILITY_REGISTRY, getCapability, getExecutableCapabilityIds, validateCapabilityParameters } from '../src/lib/agent/capability-registry.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { EXECUTABLE_PIPELINE_TOOL_IDS } from '../src/lib/workflows/executable-tools.ts';
import { safeParseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';
import { assertExecutionAllowed, cancelTask, confirmTask, createTaskContext, interpretConfirmation, transitionTask } from '../src/lib/agent/task-state.ts';

assert.equal(CAPABILITY_REGISTRY.length, TOOL_DEFINITIONS.length, 'Every canonical tool definition must have a capability contract.');
assert.ok(CAPABILITY_REGISTRY.length > 0, 'Canonical capability inventory must not be empty.');
assert.ok(TOOL_DEFINITIONS.length > 0, 'Canonical tool definitions must not be empty.');

for (const tool of TOOL_DEFINITIONS) {
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
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  steps: [{ toolId: 'image-compressor', params: { quality: 0.8 } }],
});
assert.equal(valid.success, true);

const invalidParameters = safeParseExecutionPlan({
  workflowName: 'Invalid Parameters',
  confidence: 0.9,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  steps: [{ toolId: 'image-compressor', params: { unsupportedObject: {} } }],
});
assert.throws(
  () => validateCapabilityParameters('image-compressor', { quality: 0.8, unsupportedObject: true }),
  /canonical schema validation|unsupported parameters/,
);
assert.equal(invalidParameters.success, false);

const directPlan = planFromIntent('compress this image');
assert.ok(directPlan, 'Planner must produce a plan for an executable local capability.');
assert.ok(directPlan?.steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE'), 'Planner emitted a non-executable capability.');

const unavailablePlan = planFromIntent('colorize this photo');
assert.equal(unavailablePlan, null, 'Planner must not route unavailable capabilities to execution.');

const conversionPlan = planFromIntent('convert this image to WebP');
assert.ok(conversionPlan, 'Planner must resolve a supported conversion request.');
assert.ok(conversionPlan?.steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE'), 'Planner boundary allowed an invalid tool id.');

// P0: execution is impossible until an explicit confirmation transitions the task.
let task = createTaskContext('task-test', 'trace-test');
assert.equal(task.state, 'IDLE');
assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);
task = transitionTask(task, 'PLANNED');
task = transitionTask(task, 'AWAITING_CONFIRMATION');
assert.equal(interpretConfirmation('ابدأ'), 'CONFIRM');
assert.equal(interpretConfirmation('confirm'), 'CONFIRM');
assert.equal(interpretConfirmation('إلغاء'), 'CANCEL');
assert.equal(interpretConfirmation('maybe'), 'AMBIGUOUS');
assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);
task = confirmTask(task);
assert.equal(task.state, 'EXECUTING');
assert.doesNotThrow(() => assertExecutionAllowed(task));
assert.throws(() => confirmTask(task), /Invalid task state transition/);

let cancelled = createTaskContext('cancel-test', 'trace-cancel');
cancelled = transitionTask(cancelled, 'PLANNED');
cancelled = transitionTask(cancelled, 'AWAITING_CONFIRMATION');
cancelled = cancelTask(cancelled);
assert.equal(cancelled.state, 'CANCELLED');
assert.equal(cancelTask(cancelled).state, 'CANCELLED');
assert.throws(() => transitionTask(cancelled, 'EXECUTING'), /Invalid task state transition/);

console.log(`Agent capability + P0 task-state contract tests passed: ${CAPABILITY_REGISTRY.length} capabilities mapped (${TOOL_DEFINITIONS.filter((tool) => tool.isReady).length} ready, ${TOOL_DEFINITIONS.filter((tool) => !tool.isReady).length} unavailable).`);
