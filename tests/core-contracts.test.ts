import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.VITE_SITE_URL = process.env.VITE_SITE_URL || 'https://flixoai.vercel.app';

const { CANONICAL_LOCALES, DEFAULT_LOCALE, LOCALE_METADATA, normalizeLocale } =
  await import('../src/lib/i18n/config.ts');
const { getLocalizedToolPath, getLocalizedToolUrl } =
  await import('../src/lib/routing/route-resolver.ts');
const {
  assertSafeImageInput,
  IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
  IMAGE_COMPRESSOR_MAX_PIXELS,
} = await import('../src/tools/image-compressor/file-safety.ts');
const { solveMath, verifyMathReceipt } =
  await import('../src/lib/agent/universal/math-engine.ts');

const { buildWorkflowToolCatalog, expandWorkflowTool } =
  await import('../src/lib/agent/workflow-as-tool.ts');
const { createAgentEvent, parseAgentEvent } =
  await import('../src/lib/agent/event-envelope.ts');
const { createTaskBudget, assertWithinTaskBudget } =
  await import('../src/lib/agent/task-budget.ts');
const { evaluateCapabilityApproval, evaluatePlanApproval } =
  await import('../src/lib/agent/approval-policy.ts');
const { createConversationMemory } =
  await import('../src/lib/agent/conversation.ts');

test('i18n exposes the exact 20-locale production contract', () => {
  assert.deepEqual([...CANONICAL_LOCALES], [
    'ar','en','es','fr','de','hi','id','it','ja','ko',
    'ms','nl','pl','pt','ru','sv','th','tr','uk','vi',
  ]);
  assert.equal(DEFAULT_LOCALE, 'ar');
  assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
  assert.equal(LOCALE_METADATA.en.direction, 'ltr');
  assert.equal(normalizeLocale('ar-EG'), 'ar');
  assert.equal(normalizeLocale('unknown'), 'ar');
});

test('routing resolves every tool path from the locale contract', () => {
  const tool = { path: '/en/image-compressor' };
  assert.equal(getLocalizedToolPath(tool, 'ar'), '/ar/image-compressor');
  assert.equal(getLocalizedToolPath({ path: '/image-compressor' }, 'vi'), '/vi/image-compressor');
  assert.equal(getLocalizedToolUrl('https://flixoai.vercel.app', tool, 'de'), 'https://flixoai.vercel.app/de/image-compressor');
  assert.throws(() => getLocalizedToolPath({ path: '/en/image-compressor?x=1' }, 'en'), /query\/hash/);
});

test('image compressor safety protects size and pixel boundaries', () => {
  const file = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 };
  assert.doesNotThrow(() => assertSafeImageInput(file));
  assert.doesNotThrow(() => assertSafeImageInput(file, { width: 4000, height: 3000 }));
  assert.throws(() => assertSafeImageInput({ ...file, type: 'application/octet-stream' }), /Unsupported image format/);
  assert.throws(() => assertSafeImageInput({ ...file, size: IMAGE_COMPRESSOR_MAX_INPUT_SIZE + 1 }), /10 MB browser limit/);
  assert.throws(() => assertSafeImageInput(file, { width: 0, height: 3000 }), /invalid dimensions/);
  assert.throws(() => assertSafeImageInput(file, { width: 4001, height: 10000 }), /too large for safe browser processing/);
  assert.equal(IMAGE_COMPRESSOR_MAX_PIXELS, 40_000_000);
});

test('math engine uses a constrained arithmetic grammar', () => {
  assert.equal(solveMath({ expression: '2 + 3 * 4' }).value, 14);
  assert.equal(solveMath({ expression: '(2 + 3) * 4' }).value, 20);
  assert.equal(solveMath({ expression: '2 ^ 3 ^ 2' }).value, 512);
  assert.equal(solveMath({ expression: '10 / 4' }).value, 2.5);
  assert.equal(solveMath({ expression: '-5 + 2' }).value, -3);
  assert.throws(() => solveMath({ expression: '1 / 0' }), /MATH_DIVISION_BY_ZERO/);
  assert.throws(() => solveMath({ expression: 'Math.max(1, 2)' }), /MATH_EXPRESSION_UNSUPPORTED/);
  const receipt = solveMath({ expression: '6 * 7' });
  assert.equal(typeof receipt.timestamp, 'string');
  assert.equal(verifyMathReceipt(receipt), true);
  assert.equal(verifyMathReceipt({ ...receipt, value: 43 }), false);
});


test('agent workflow tools expand only through the canonical workflow registry', () => {
  const catalog = buildWorkflowToolCatalog();
  const product = catalog.find((item) => item.id === 'workflow:product-ready');
  assert.ok(product);
  assert.equal(product?.kind, 'workflow');
  assert.equal(product?.executable, true);
  const expanded = expandWorkflowTool('workflow:product-ready');
  assert.ok(expanded);
  assert.ok((expanded?.steps.length ?? 0) >= 1);
  assert.equal(expanded?.catalogFingerprint.length, 64);
});

test('agent events are versioned and idempotency-addressable', () => {
  const event = createAgentEvent({
    source: 'CHAT',
    type: 'INPUT_RECEIVED',
    conversationId: 'conversation-test',
    taskId: 'task-test',
    idempotencyKey: 'input-task-test-1',
    payload: { ok: true },
  });
  assert.equal(parseAgentEvent(event).eventId, event.eventId);
  assert.equal(event.version, 1);
  assert.equal(event.taskId, 'task-test');
});

test('agent task budgets block unbounded provider and tool work', () => {
  const budget = createTaskBudget({ maxProviderCalls: 2, maxToolCalls: 3, maxSteps: 2 });
  const usage = { steps: 0, toolCalls: 0, providerCalls: 0, retries: 0, startedAtMs: Date.now() };
  assert.doesNotThrow(() => assertWithinTaskBudget(budget, usage, { providerCalls: 1, toolCalls: 1, steps: 1 }));
  assert.throws(
    () => assertWithinTaskBudget(budget, { ...usage, providerCalls: 2 }, { providerCalls: 1 }),
    /TASK_BUDGET_PROVIDER_CALLS_EXCEEDED/,
  );
  assert.throws(
    () => assertWithinTaskBudget(budget, { ...usage, toolCalls: 3 }, { toolCalls: 1 }),
    /TASK_BUDGET_TOOL_CALLS_EXCEEDED/,
  );
});

test('approval policy is fail-closed for non-executable external capabilities', () => {
  assert.equal(evaluateCapabilityApproval('image-compressor').level, 'AUTO');
  assert.equal(evaluateCapabilityApproval('ai-image-generator').level, 'BLOCK');
  const plan = {
    workflowName: 'safe',
    confidence: 1,
    catalogFingerprint: '0'.repeat(64),
    steps: [{ toolId: 'image-compressor', params: { quality: 0.8 } }],
  } as never;
  assert.equal(evaluatePlanApproval(plan).level, 'AUTO');
});

test('conversation memory gets durable identities without requiring server state', () => {
  const memory = createConversationMemory();
  assert.ok(memory.conversationId);
  assert.equal(memory.taskId, null);
});
