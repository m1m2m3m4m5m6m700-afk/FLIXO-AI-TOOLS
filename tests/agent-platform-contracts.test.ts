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
} = await import('../src/lib/agent/execution-budget.ts');
const {
  WORKFLOW_TOOL_CATALOG,
  getWorkflowTool,
  resolveWorkflowTool,
  getWorkflowForTool,
} = await import('../src/lib/agent/workflow-as-tool.ts');
const { planFromIntent } = await import('../src/lib/ai/planner.ts');

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
  const plan = planFromIntent('prepare a product image for a store');
  assert.ok(getWorkflowForTool('workflow:product-ready'));
  assert.ok(plan);
  assert.equal(plan?.steps[0]?.toolId, 'background-remover');
});
