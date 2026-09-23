import assert from 'node:assert/strict';
import { assessCognitiveRequest, decideRecovery, proposeBoundedReplan, verifyExecutionPlanSemantics } from '../src/lib/agent/cognitive-orchestrator.ts';
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
