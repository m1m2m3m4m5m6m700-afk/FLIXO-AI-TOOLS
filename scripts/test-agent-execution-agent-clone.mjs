import assert from 'node:assert/strict';
import { createFlixoBotRunState, startRun, recordToolCall, restoreFlixoBotRunState, approveRun } from '../src/lib/agent/flixo-bot-openai-runtime.ts';
import fs from 'node:fs';
import { EXECUTION_AGENT_CLONE_ID, EXECUTION_AGENT_CLONE_IDENTITY, buildExecutionAgentCloneOutcome, cancelExecutionAgentClone, cloneDecision, confirmExecutionAgentClone, createExecutionAgentCloneSession, recoverExecutionAgentClone, refreshExecutionAgentCloneSession } from '../src/lib/agent/execution-agent-clone.ts';

assert.equal(EXECUTION_AGENT_CLONE_ID, 'execution-agent-clone-v1');
assert.equal(EXECUTION_AGENT_CLONE_IDENTITY.baseRole, 'executionAgent');
assert.equal(EXECUTION_AGENT_CLONE_IDENTITY.executorAuthority, 'PIPELINE_RUNNER_ONLY');

const ready = createExecutionAgentCloneSession('compress the image', { taskId: 'clone-task-1', traceId: 'clone-trace-1' });
assert.equal(cloneDecision(ready), 'EXECUTE_READY');
assert.ok(ready.prepared);
assert.equal(ready.assessment.collectiveIntelligence.version, 'FLIXO-BOT-BRAIN-v1');
assert.equal(ready.assessment.collectiveIntelligence.authority, 'ADVISORY_ONLY');
assert.equal(ready.assessment.collectiveIntelligence.mutationAuthority, false);
assert.equal(ready.assessment.collectiveIntelligence.certificationAuthority, false);
assert.equal(ready.prepared.task.state, 'AWAITING_CONFIRMATION');

const refreshed = refreshExecutionAgentCloneSession(ready);
assert.equal(refreshed.taskId, ready.taskId);
assert.equal(refreshed.traceId, ready.traceId);
assert.equal(cloneDecision(refreshed), 'EXECUTE_READY');

const confirmed = await confirmExecutionAgentClone(ready);
assert.equal(confirmed.prepared?.task.state, 'EXECUTING');

const cancelled = cancelExecutionAgentClone(ready);
assert.equal(cancelled.prepared?.task.state, 'CANCELLED');

const needsInput = createExecutionAgentCloneSession('convert the image', { taskId: 'clone-task-2', traceId: 'clone-trace-2' });
assert.equal(cloneDecision(needsInput), 'NEEDS_INPUT');
assert.equal(needsInput.prepared, null);

assert.equal(recoverExecutionAgentClone(ready, 'SECURITY', 0).action, 'FAIL_CLOSED');
assert.equal(recoverExecutionAgentClone(ready, 'OUTPUT', 0).action, 'RETRY_CANONICAL');

const exactSha = 'a'.repeat(40);
const outcome = buildExecutionAgentCloneOutcome({ missionId: 'clone-mission-1', exactSha, outcome: 'SUCCESS', capabilityId: 'image-compressor', verified: true, validationPassed: true, evidenceRefs: ['unit-test'] });
assert.equal(outcome.learning, 'VERIFIED_KNOWLEDGE');
assert.equal(outcome.mission.botId, EXECUTION_AGENT_CLONE_ID);

const source = fs.readFileSync(new URL('../src/lib/agent/execution-agent-clone.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /executor-registry/u);
assert.doesNotMatch(source, /git\s+(add|commit|push)/u);
assert.doesNotMatch(source, /refs\/heads\/(?:main|execution)/u);


const EXACT_SHA = 'a'.repeat(40);
const runtimeCreated = createFlixoBotRunState({
  taskId: 'fixture-task',
  agentId: 'FLIXO-BOT',
  exactSha: EXACT_SHA,
  request: 'fixture approval',
  maxTurns: 6,
  maxRetries: 2,
});
const runtimeRunning = startRun(runtimeCreated, EXACT_SHA);
const approvalCall = recordToolCall(
  runtimeRunning,
  EXACT_SHA,
  {
    toolId: 'image-compressor',
    callId: 'fixture-call',
    actorId: 'assistantController',
    branch: 'execution',
    exactSha: EXACT_SHA,
    expectedSha: EXACT_SHA,
    mutation: false,
    certification: false,
    requiresApproval: true,
  },
  { mutationAuthority: false, certificationAuthority: false },
);
assert.equal(approvalCall.decision.reason, 'APPROVAL_REQUIRED');
const approvalFixture = approvalCall.state;
assert.equal(approvalFixture.status, 'WAITING_APPROVAL');
assert.ok(approvalFixture.pendingApproval);
assert.throws(() => approveRun(approvalFixture, EXACT_SHA, 'wrong-id'), /FLIXO_BOT_APPROVAL_ID_MISMATCH/);
const runtimeApproved = approveRun(approvalFixture, EXACT_SHA, approvalFixture.pendingApproval.approvalId);
assert.equal(runtimeApproved.status, 'RUNNING');
assert.equal(runtimeApproved.events.at(-1)?.detail?.approvalId, approvalFixture.pendingApproval.approvalId);
const restored = restoreFlixoBotRunState(JSON.stringify(runtimeApproved), EXACT_SHA);
assert.equal(restored.runId, runtimeApproved.runId);

console.log('Execution agent clone tests passed.');