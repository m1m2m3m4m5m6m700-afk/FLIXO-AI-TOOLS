import assert from 'node:assert/strict';
import {
  FLIXO_BOT_CANONICAL_BRANCH,
  applyNextStep,
  assertCurrentRunSha,
  buildNestedAgentToolDescriptor,
  cancelRun,
  createFlixoBotRunState,
  createTrace,
  evaluateToolRequest,
  finishTraceSpan,
  markRunStale,
  recordToolCall,
  recordToolResult,
  restoreFlixoBotRunState,
  scheduleRetry,
  serializeFlixoBotRunState,
  startRun,
  startTraceSpan,
} from '../../src/lib/agent/flixo-bot-openai-runtime.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const base = createFlixoBotRunState({
  taskId: 'OPENAI-RUNTIME-ISOLATED',
  agentId: 'ACTION-REPAIR',
  exactSha: SHA_A,
  branch: FLIXO_BOT_CANONICAL_BRANCH,
  request: 'repair latest exact-SHA RED without weakening gates',
  maxTurns: 3,
  maxRetries: 2,
});
assert.equal(base.status, 'CREATED');
assert.equal(base.events.length, 1);

const running = startRun(base, SHA_A);
assert.equal(running.status, 'RUNNING');
assert.equal(running.turnCount, 1);

const nested = buildNestedAgentToolDescriptor({
  toolId: 'rca-agent',
  childAgentId: 'READ-INVESTIGATOR',
  description: 'analyze causal source without mutation or certification',
});
assert.equal(nested.executionMode, 'AGENT_AS_TOOL');
assert.equal(nested.mutationAuthority, false);
assert.equal(nested.certificationAuthority, false);
assert.equal(nested.handoffTransfersAuthority, false);

const request = {
  toolId: nested.toolId,
  callId: 'call-001',
  actorId: running.currentOwner,
  branch: FLIXO_BOT_CANONICAL_BRANCH,
  exactSha: SHA_A,
  expectedSha: SHA_A,
  mutation: false,
  certification: false,
  requiresApproval: false,
};

assert.deepEqual(
  evaluateToolRequest(request, { mutationAuthority: false, certificationAuthority: false }),
  { allowed: true, reason: 'ALLOW' },
);

const called = recordToolCall(running, SHA_A, request, {
  mutationAuthority: false,
  certificationAuthority: false,
});
assert.equal(called.decision.allowed, true);
assert.equal(called.state.events.at(-1)?.type, 'TOOL_CALL');

const toolDone = recordToolResult(
  called.state, SHA_A, running.currentOwner, nested.toolId, true, { finding: 'causal source' },
);
assert.equal(toolDone.lastError, null);

const again = applyNextStep(toolDone, SHA_A, { type: 'RUN_AGAIN', reason: 'independent verification' });
assert.equal(again.turnCount, 2);

const retry = scheduleRetry(again, SHA_A, 'transient provider error');
assert.equal(retry.status, 'RETRYING');
assert.equal(retry.retryCount, 1);

const final = applyNextStep(retry, SHA_A, { type: 'FINAL', output: { verified: true } });
assert.equal(final.status, 'SUCCEEDED');

assert.throws(
  () => recordToolCall(final, SHA_A, request, { mutationAuthority: false, certificationAuthority: false }),
  /FLIXO_BOT_TOOL_CALL_INVALID_STATE/,
);

const restored = restoreFlixoBotRunState(serializeFlixoBotRunState(final), SHA_A);
assert.equal(restored.runId, final.runId);
assert.equal(restored.events.length, final.events.length);

assert.throws(() => assertCurrentRunSha(final, SHA_B), /FLIXO_BOT_RUN_STALE_SHA/);
const stale = markRunStale(final, SHA_B);
assert.equal(stale.status, 'STALE');
assert.throws(
  () => restoreFlixoBotRunState(serializeFlixoBotRunState(stale), SHA_B),
  /FLIXO_BOT_RUN_ALREADY_STALE/,
);

assert.deepEqual(
  evaluateToolRequest({ ...request, mutation: true }, { mutationAuthority: false, certificationAuthority: false }),
  { allowed: false, reason: 'AUTHORITY_REQUIRED' },
);
assert.deepEqual(
  evaluateToolRequest({ ...request, certification: true }, { mutationAuthority: false, certificationAuthority: false }),
  { allowed: false, reason: 'CERTIFICATION_FORBIDDEN' },
);
const approval = recordToolCall(
  running, SHA_A, { ...request, requiresApproval: true },
  { mutationAuthority: false, certificationAuthority: false },
);
assert.equal(approval.state.status, 'WAITING_APPROVAL');

assert.deepEqual(
  evaluateToolRequest({ ...request, branch: 'main' }, { mutationAuthority: false, certificationAuthority: false }),
  { allowed: false, reason: 'WRONG_WORK_PATH' },
);

const limited = startRun(createFlixoBotRunState({
  taskId: 'TURN-LIMIT',
  agentId: 'ACTION-REPAIR',
  exactSha: SHA_A,
  request: 'bounded turns',
  maxTurns: 1,
}), SHA_A);
const failed = applyNextStep(limited, SHA_A, { type: 'RUN_AGAIN', reason: 'budget test' });
assert.equal(failed.status, 'FAILED');

const handoff = applyNextStep(running, SHA_A, {
  type: 'HANDOFF', targetAgentId: 'READ-ADVERSARY', reason: 'independent challenge',
});
assert.equal(handoff.currentOwner, 'READ-ADVERSARY');
assert.equal(handoff.events.at(-1)?.detail?.authorityTransferred, false);

const trace = startTraceSpan(createTrace('trace-isolated'), {
  kind: 'RUN', name: 'isolated runtime', parentSpanId: null, attributes: { protocol: 'v1' },
});
const traceChild = startTraceSpan(trace, {
  kind: 'TOOL', name: 'rca-agent', parentSpanId: trace.spans[0]?.spanId ?? null,
  attributes: { executionMode: 'AGENT_AS_TOOL' },
});
const traceDone = finishTraceSpan(traceChild, traceChild.spans[1]?.spanId ?? '');
assert.equal(traceDone.spans.length, 2);
assert.ok(traceDone.spans[1]?.endedAt);

const cancelled = cancelRun(running, SHA_A, 'operator stop');
assert.equal(cancelled.status, 'CANCELLED');

console.log('FLIXO BOT isolated OpenAI-derived runtime contract tests passed.');
