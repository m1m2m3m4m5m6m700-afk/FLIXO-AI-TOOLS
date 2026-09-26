import assert from 'node:assert/strict';
import { parseAgentDecision } from '../../src/lib/contracts/agent-gateway.ts';
import {
  beginFlixoBotGatewayRuntime,
  beginModelTurn,
  finalizeFlixoBotGatewayRuntime,
  finishModelTurn,
  noteProviderFailure,
  markFlixoBotGatewayRuntimeStale,
  toFlixoBotRuntimeSummary,
} from '../../src/lib/agent/flixo-bot-runtime-adapter.ts';
import {
  createFlixoBotRunState,
  restoreFlixoBotRunState,
} from '../../src/lib/agent/flixo-bot-openai-runtime.ts';

const SHA = 'a'.repeat(40);
const runtime0 = beginFlixoBotGatewayRuntime({
  taskId: 'UI-FLIXO-BOT:test',
  exactSha: SHA,
  request: 'create a safe image plan',
});
assert.equal(runtime0.state.status, 'RUNNING');

const model = beginModelTurn(runtime0, 'openai');
assert.equal(model.runtime.trace.spans.at(-1)?.kind, 'MODEL');
const runtime1 = finishModelTurn(model.runtime, model.spanId, 'success');
assert.ok(runtime1.trace.spans.at(-1)?.endedAt);

const retried = noteProviderFailure(runtime1, 'provider timeout');
assert.equal(retried.state.status, 'RETRYING');
assert.equal(retried.state.retryCount, 1);

const completed = finalizeFlixoBotGatewayRuntime(
  retried,
  'plan',
  { mode: 'plan', plan: { workflowName: 'fixture' } },
);
assert.equal(completed.state.status, 'WAITING_APPROVAL');

const summary = toFlixoBotRuntimeSummary(completed);
assert.equal(summary.protocol, 'FLIXO-BOT-OPENAI-RUNTIME-v1');
assert.equal(summary.status, 'WAITING_APPROVAL');
assert.equal(summary.exactSha, SHA);
assert.ok(summary.resumeState.length > 100);

const restored = restoreFlixoBotRunState(summary.resumeState, SHA);
assert.equal(restored.runId, summary.runId);
assert.equal(restored.status, 'WAITING_APPROVAL');

const parsed = parseAgentDecision({
  mode: 'chat',
  reply: 'runtime attached',
  question: null,
  plan: null,
  confidence: 0.8,
  runtime: summary,
});
assert.equal(parsed.runtime?.runId, summary.runId);
assert.equal(parsed.runtime?.status, 'WAITING_APPROVAL');

console.log('FLIXO BOT gateway runtime integration contract passed.');

const stale = markFlixoBotGatewayRuntimeStale(completed, 'b'.repeat(40));
assert.equal(stale.state.status, 'STALE');
assert.equal(toFlixoBotRuntimeSummary(stale).status, 'STALE');
