import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createAgentEvent, AgentEventInbox, deriveEventIdempotencyKey } =
  await import('../src/lib/agent/event-gateway.ts');
const {
  createExecutionBudget,
  consumeStep,
  consumeToolCall,
  consumeRetry,
  consumeOutputBytes,
} = await import('../packages/agent-runtime/src/execution-budget.ts');
const {
  WORKFLOW_TOOL_CATALOG,
  getWorkflowTool,
  resolveWorkflowTool,
  getWorkflowForTool,
  expandWorkflowTool,
} = await import('../src/lib/agent/workflow-as-tool.ts');
const { planFromIntent } = await import('../src/lib/ai/planner.ts');
const { evaluateCapabilityApproval, evaluatePlanApproval } = await import('../src/lib/agent/approval-policy.ts');



test('agent event envelope is canonical and idempotent', () => {
  const firstKey = deriveEventIdempotencyKey({
    source: 'USER_MESSAGE',
    eventType: 'chat.message',
    conversationId: 'conversation-1',
    payload: { text: 'crop this' },
  });
  const secondKey = deriveEventIdempotencyKey({
    source: 'USER_MESSAGE',
    eventType: 'chat.message',
    conversationId: 'conversation-1',
    payload: { text: 'crop this' },
  });
  assert.equal(firstKey, secondKey);

  const event = createAgentEvent({
    source: 'USER_MESSAGE',
    eventType: 'chat.message',
    conversationId: 'conversation-1',
    payload: { text: 'crop this' },
  });
  const inbox = new AgentEventInbox();
  assert.equal(inbox.accept(event), true);
  assert.equal(inbox.accept(event), false);
});

test('execution budget fails closed at hard limits', () => {
  let budget = createExecutionBudget({ maxSteps: 1, maxToolCalls: 1, maxRetries: 1, maxOutputBytes: 10 });
  budget = consumeStep(budget);
  budget = consumeToolCall(budget);
  budget = consumeRetry(budget);
  budget = consumeOutputBytes(budget, 10);
  assert.equal(budget.usage.steps, 1);
  assert.equal(budget.usage.toolCalls, 1);
  assert.equal(budget.usage.retries, 1);
  assert.equal(budget.usage.outputBytes, 10);
  assert.throws(() => consumeToolCall(budget), /EXECUTION_BUDGET_EXCEEDED:toolCalls/);
  assert.throws(() => consumeOutputBytes(budget, 1), /EXECUTION_BUDGET_EXCEEDED:outputBytes/);
});

test('workflow tools are derived from the canonical workflow registry', () => {
  assert.ok(WORKFLOW_TOOL_CATALOG.length >= 6);
  const product = getWorkflowTool('workflow:product-ready');
  assert.equal(product?.kind, 'WORKFLOW_TOOL');
  assert.ok(product?.stepToolIds.includes('background-remover'));

  assert.equal(resolveWorkflowTool('prepare a product image for a store')?.id, 'workflow:product-ready');
  const expanded = expandWorkflowTool('workflow:product-ready');
  assert.ok(getWorkflowForTool('workflow:product-ready'));
  assert.ok(expanded);
  assert.equal(expanded?.steps[0]?.toolId, 'background-remover');
  assert.equal(planFromIntent('prepare a product image for a shop, square')?.steps[0]?.toolId, 'background-remover');
});


test('runtime rejects the first tool call beyond the canonical call budget', async () => {
  const {
    createFlixoBotRunState,
    startRun,
    recordToolCall,
  } = await import('../src/lib/agent/flixo-bot-openai-runtime.ts');

  const sha = 'a'.repeat(40);
  let state = createFlixoBotRunState({
    taskId: 'budget-task',
    agentId: 'test-agent',
    exactSha: sha,
    request: 'test budget',
    maxToolCalls: 2,
  });
  state = startRun(state, sha);

  for (let index = 0; index < 2; index += 1) {
    const result = recordToolCall(state, sha, {
      toolId: 'image-compressor',
      callId: `call-${index}`,
      actorId: 'test-agent',
      branch: 'execution',
      exactSha: sha,
      expectedSha: sha,
      mutation: false,
      certification: false,
      requiresApproval: false,
    }, { mutationAuthority: true, certificationAuthority: false });
    assert.equal(result.decision.allowed, true);
    state = result.state;
  }

  const blocked = recordToolCall(state, sha, {
    toolId: 'image-compressor',
    callId: 'call-3',
    actorId: 'test-agent',
    branch: 'execution',
    exactSha: sha,
    expectedSha: sha,
    mutation: false,
    certification: false,
    requiresApproval: false,
  }, { mutationAuthority: true, certificationAuthority: false });

  assert.equal(blocked.decision.allowed, false);
  assert.equal(blocked.decision.reason, 'BUDGET_EXCEEDED');
  assert.equal(blocked.state.status, 'BLOCKED');
});


test('layered memory preserves source/state distinctions and stays prompt-bounded', async () => {
  const {
    createLayeredMemory,
    deriveLayeredMemorySnapshot,
    parseLayeredMemory,
    rememberMemory,
    toPromptMemory,
  } = await import('../src/lib/agent/layered-memory.ts');

  let memory = createLayeredMemory('task-memory');
  memory = rememberMemory(memory, {
    layer: 'USER',
    key: 'taste',
    value: 'prefer square outputs',
    source: 'USER',
    state: 'VERIFIED',
    confidence: 1,
    evidenceRefs: ['turn-1'],
  });
  assert.equal(memory.items[0]?.state, 'VERIFIED');

  const derived = deriveLayeredMemorySnapshot({
    taskId: 'task-memory',
    activeCommand: 'make it square',
    activeToolId: 'image-cropper',
    pendingQuestion: null,
    turns: [{ role: 'user', text: 'make it square' }],
  });
  assert.ok(derived.items.some((item) => item.layer === 'TASK' && item.key === 'active.command'));
  assert.ok(derived.items.some((item) => item.layer === 'CONVERSATION' && item.source === 'USER'));

  const parsed = parseLayeredMemory(derived);
  assert.equal(parsed.taskId, 'task-memory');
  assert.ok(toPromptMemory(parsed).length > 0);
  assert.throws(
    () => parseLayeredMemory({
      ...derived,
      items: [{
        ...derived.items[0],
        value: 'x'.repeat(8_001),
      }],
    }),
    /too_big|String must contain at most 8000 character/,
  );
});

test('chat gateway accepts layered memory but keeps it advisory', async () => {
  const { parseAgentRequest } = await import('../src/lib/contracts/agent-gateway.ts');
  const request = parseAgentRequest({
    locale: 'en',
    messages: [{ role: 'user', content: 'same as before' }],
    activeCommand: 'prepare product image',
    memory: {
      version: 1,
      taskId: 'task-1',
      items: [{
        id: 'task:active.command',
        layer: 'TASK',
        key: 'active.command',
        value: 'prepare product image',
        source: 'MEMORY',
        state: 'PROBABLE',
        confidence: 0.95,
        evidenceRefs: ['conversation.activeCommand'],
        updatedAt: '2026-09-26T20:00:00.000Z',
      }],
    },
  });
  assert.equal(request.memory?.items[0]?.state, 'PROBABLE');
});


test('approval policy is fail-closed for non-executable capabilities and explicit for network work', async () => {
  assert.equal(evaluateCapabilityApproval('image-compressor').level, 'AUTO');
  const cloud = evaluateCapabilityApproval('ai-image-generator');
  assert.equal(cloud.level, 'CONFIRM');
  assert.ok(cloud.reasons.length > 0);

  const plan = planFromIntent('compress this image');
  assert.ok(plan);
  assert.equal(evaluatePlanApproval(plan!).level, 'AUTO');
  assert.ok(evaluatePlanApproval(plan!).reasons.length > 0);
});


test('external event ingress rejects unauthenticated public requests before persistence', async () => {
  const { default: handler } = await import('../api/flixo-event.ts');

  const req = {
    method: 'POST',
    headers: {
      'x-flixo-event-secret': 'wrong-secret',
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{}');
    },
  } as unknown as import('node:http').IncomingMessage;

  const response = {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: '',
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    end(value?: string) {
      this.body = value ?? '';
    },
  } as unknown as import('node:http').ServerResponse;

  process.env.FLIXO_EVENT_GATEWAY_SECRET = 'expected-secret';
  try {
    await handler(req, response);
  } finally {
    delete process.env.FLIXO_EVENT_GATEWAY_SECRET;
  }

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /Unauthorized event gateway request/u);
});
