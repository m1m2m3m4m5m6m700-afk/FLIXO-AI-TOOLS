import assert from 'node:assert/strict';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { assessCognitiveRequest, assessCognitiveRequestWithRuntimeControls, decideRecovery, planFromIntent, proposeBoundedReplan, validateCanonicalExecutionPlanWithRuntimeControls, validateExecutionPlanWithRuntimeControls, verifyExecutionPlanSemantics } from '../src/lib/agent/cognitive-orchestrator.ts';
import { buildAgentOutcome } from '../src/lib/agent/cognitive-outcome.ts';

const compress = assessCognitiveRequest('compress the image');
assert.equal(compress.decision, 'EXECUTE_READY');
assert.ok(compress.executionPlan);
assert.equal(compress.semantic.ok, true);
assert.equal(compress.semantic.localFirstSatisfied, true);

const convert = assessCognitiveRequest('convert the image');
assert.equal(convert.decision, 'NEEDS_INPUT');
assert.ok(convert.clarificationQuestion);

const cloudLeak = assessCognitiveRequest('compress the image');
const fakeCloudPlan = {
  ...compress.executionPlan,
  steps: [{ toolId: 'ai-image-generator', params: {} }],
};
const semanticCloud = verifyExecutionPlanSemantics(cloudLeak.intentPlan, fakeCloudPlan);
assert.equal(semanticCloud.ok, false);
assert.ok(semanticCloud.reasons.includes('INTENT_CAPABILITY_MISMATCH'));
assert.ok(semanticCloud.reasons.includes('LOCAL_FIRST_VIOLATION'));

const retry = decideRecovery('image-compressor', 'OUTPUT', 0);
assert.equal(retry.action, 'RETRY_CANONICAL');
assert.equal(retry.recovery.retryAllowed, true);

const failClosed = decideRecovery('image-compressor', 'SECURITY', 0);
assert.equal(failClosed.action, 'FAIL_CLOSED');

const replan = proposeBoundedReplan('compress the image', compress.executionPlan);
assert.equal(replan, null);

const runtime = await assessCognitiveRequestWithRuntimeControls('compress the image');
assert.equal(runtime.ready, true);
assert.equal(runtime.goal?.status, 'SATISFIED');
assert.equal(runtime.goal?.stuck.severity, 'NONE');
assert.ok(runtime.executionPlan);
assert.equal(runtime.delegation.length, runtime.executionPlan.steps.length);
assert.ok(runtime.delegation.every((entry) => entry.status === 'COMPLETED'));

const deterministicPlan = planFromIntent('compress this image under 200KB and convert to WebP');
assert.ok(deterministicPlan);
const canonicalRuntime = await validateCanonicalExecutionPlanWithRuntimeControls(deterministicPlan);
assert.equal(canonicalRuntime.ready, true);
assert.equal(canonicalRuntime.goal.status, 'SATISFIED');
assert.equal(canonicalRuntime.goal.assessments.at(-1)?.reason, 'CANONICAL_EXECUTION_CONTRACT_VALID');
assert.equal(canonicalRuntime.delegation.length, deterministicPlan.steps.length);
assert.ok(canonicalRuntime.delegation.every((entry) => entry.status === 'COMPLETED'));

const blockedRuntime = await validateExecutionPlanWithRuntimeControls(
  cloudLeak.intentPlan,
  fakeCloudPlan,
  'compress the image',
  [
    { kind: 'TOOL', signature: 'tool:A' },
    { kind: 'TOOL', signature: 'tool:B' },
    { kind: 'TOOL', signature: 'tool:A' },
    { kind: 'TOOL', signature: 'tool:B' },
    { kind: 'TOOL', signature: 'tool:A' },
    { kind: 'TOOL', signature: 'tool:B' },
  ],
);
assert.equal(blockedRuntime.ready, false);
assert.equal(blockedRuntime.goal.status, 'BLOCKED');
assert.equal(blockedRuntime.goal.stuck.severity, 'STUCK');
assert.equal(blockedRuntime.goal.stuck.recommendation, 'REPLAN');

const exactSha = 'a'.repeat(40);
const success = buildAgentOutcome({
  missionId: 'mission-1',
  taskId: 'task-1',
  botId: 'executionAgent',
  exactSha,
  outcome: 'SUCCESS',
  capabilityId: 'image-compressor',
  inputDescription: 'image-compressor',
  verified: true,
  validationPassed: true,
  evidenceRefs: ['unit-test'],
});
assert.equal(success.learning, 'VERIFIED_KNOWLEDGE');

const failure = buildAgentOutcome({
  missionId: 'mission-2',
  taskId: 'task-2',
  botId: 'executionAgent',
  exactSha,
  outcome: 'FAILURE',
  capabilityId: 'image-compressor',
  inputDescription: 'image-compressor',
  verified: false,
  validationPassed: false,
  evidenceRefs: ['unit-test'],
  error: new Error('output verification failed'),
});
assert.equal(failure.learning, 'ANTI_LESSON');
assert.match(failure.failureFingerprint ?? '', /^[a-f0-9]{64}$/u);

console.log('Cognitive closed-loop tests passed.');
