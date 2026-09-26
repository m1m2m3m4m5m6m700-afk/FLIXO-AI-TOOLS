import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createScheduledAgentJob,
  isScheduleDue,
  advanceScheduledAgentJob,
  matchesEventTrigger,
} from '../src/lib/agent/scheduler.ts';
import { createAgentEvent } from '../src/lib/agent/event-gateway.ts';
import {
  normalizeIngestion,
  runIngestionPipeline,
  ingestionFromAgentEvent,
} from '../src/lib/agent/ingestion-pipeline.ts';
import {
  replayFlixoBotEvents,
  createFlixoBotRunState,
  startRun,
  recordToolCall,
  applyNextStep,
  type FlixoBotToolRequest,
} from '../src/lib/agent/flixo-bot-openai-runtime.ts';
import { createExecutionBudget, consumeCost } from '../src/lib/agent/execution-budget.ts';
import { evaluatePlanApproval } from '../src/lib/agent/approval-policy.ts';
import { deriveLayeredMemorySnapshot } from '../src/lib/agent/layered-memory.ts';
import { WORKFLOW_TOOL_CATALOG, getWorkflowTool, expandWorkflowTool } from '../src/lib/agent/workflow-as-tool.ts';

test('scheduler is durable-state friendly and advances recurring jobs deterministically', () => {
  const job = createScheduledAgentJob({
    scheduleId: 'schedule-1',
    ownerId: 'user-1',
    prompt: 'prepare my morning report',
    nextRunAt: '2026-09-27T00:00:00.000Z',
    intervalSeconds: 3600,
    maxRuns: 2,
  });
  assert.equal(isScheduleDue(job, '2026-09-27T00:01:00.000Z'), true);

  const first = advanceScheduledAgentJob(job, '2026-09-27T00:02:00.000Z', 'event-1');
  assert.equal(first.active, true);
  assert.equal(first.runCount, 1);
  assert.equal(first.nextRunAt, '2026-09-27T01:02:00.000Z');

  const second = advanceScheduledAgentJob(first, '2026-09-27T01:02:00.000Z', 'event-2');
  assert.equal(second.active, false);
  assert.equal(second.runCount, 2);
});

test('event-driven rules match by event type, source, and required payload keys', () => {
  const event = createAgentEvent({
    source: 'TOOL_RESULT',
    eventType: 'execution.finished',
    payload: { artifactId: 'asset-1' },
  });
  assert.equal(matchesEventTrigger(event, {
    source: 'TOOL_RESULT',
    eventType: 'execution.finished',
    requiredPayloadKeys: ['artifactId'],
  }), true);
  assert.equal(matchesEventTrigger(event, {
    source: 'TOOL_RESULT',
    eventType: 'execution.finished',
    requiredPayloadKeys: ['missing'],
  }), false);
});

test('universal ingestion normalizes all inputs without owning transport concerns', async () => {
  const normalized = normalizeIngestion({
    source: 'PDF',
    locator: 'file:report.pdf',
    mimeType: 'application/pdf',
    text: '  hello   world  ',
    bytes: 128,
    metadata: { pageCount: 2 },
  });
  assert.equal(normalized.normalizedText, 'hello world');

  const transformed = await runIngestionPipeline(
    {
      source: 'WEB',
      locator: 'https://example.test',
      mimeType: 'text/html',
      text: 'a b',
      bytes: 10,
      metadata: {},
    },
    {
      transform: (input) => ({ ...input, normalizedText: input.normalizedText.toUpperCase() }),
      verify: (input) => input.normalizedText === 'A B',
    },
  );
  assert.equal(transformed.normalizedText, 'A B');

  const event = createAgentEvent({
    source: 'USER_MESSAGE',
    eventType: 'chat.message',
    payload: { text: 'hello', bytes: 5 },
  });
  assert.equal(ingestionFromAgentEvent(event).source, 'CONVERSATION');
});

test('workflow-as-a-tool exposes first-class contracts and approval semantics', () => {
  assert.ok(WORKFLOW_TOOL_CATALOG.length >= 6);
  const workflow = getWorkflowTool('workflow:product-ready');
  assert.ok(workflow);
  assert.equal(workflow?.contractVersion, 1);
  assert.equal(workflow?.kind, 'WORKFLOW_TOOL');
  assert.ok(workflow?.inputSchema);
  assert.ok(workflow?.outputSchema);
  const plan = expandWorkflowTool('workflow:product-ready');
  assert.ok(plan);
  assert.equal(evaluatePlanApproval(plan).level, 'AUTO');
});

test('layered memory separates current turn from verified system knowledge', () => {
  const memory = deriveLayeredMemorySnapshot({
    taskId: 'task-memory',
    turns: [
      { role: 'user', text: 'old request' },
      { role: 'user', text: 'current request' },
    ],
    verifiedKnowledge: [
      { key: 'system.rule', value: 'canonical contracts are authoritative', evidenceRefs: ['contract:1'] },
    ],
  });
  assert.ok(memory.items.some((item) => item.layer === 'CURRENT_TURN' && item.key === 'current.turn'));
  assert.ok(memory.items.some((item) => item.layer === 'SYSTEM_KNOWLEDGE' && item.key === 'system.rule'));
});

test('execution budgets enforce monetary ceilings', () => {
  let budget = createExecutionBudget({ maxCostMicrounits: 100 });
  budget = consumeCost(budget, 60);
  assert.equal(budget.usage.costMicrounits, 60);
  assert.throws(() => consumeCost(budget, 41), /EXECUTION_BUDGET_EXCEEDED:costMicrounits/);
});

test('runtime event replay validates the durable execution trace', () => {
  const sha = 'a'.repeat(40);
  let state = createFlixoBotRunState({
    taskId: 'trace-task',
    agentId: 'trace-agent',
    exactSha: sha,
    request: 'trace me',
    maxToolCalls: 2,
  });
  state = startRun(state, sha);
  const request: FlixoBotToolRequest = {
    toolId: 'image-compressor',
    callId: 'call-1',
    actorId: 'trace-agent',
    branch: 'execution',
    exactSha: sha,
    expectedSha: sha,
    mutation: false,
    certification: false,
    requiresApproval: false,
  };
  const toolCall = recordToolCall(state, sha, request, {
    mutationAuthority: true,
    certificationAuthority: false,
  });
  state = toolCall.state;
  state = applyNextStep(state, sha, { type: 'FINAL', output: { ok: true } });
  const replayed = replayFlixoBotEvents(state.events);
  assert.equal(replayed.status, 'SUCCEEDED');
  assert.equal(replayed.toolCallCount, 1);
  assert.equal(replayed.lastSeq, state.events.length);
});
