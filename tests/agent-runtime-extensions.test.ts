import assert from 'node:assert/strict';
import { test } from 'node:test';

test('workflow-as-tool exposes canonical input/output contracts and derived risk', async () => {
  const {
    getWorkflowTool,
    expandWorkflowTool,
  } = await import('../src/lib/agent/workflow-as-tool.ts');

  const product = getWorkflowTool('workflow:product-ready');
  assert.ok(product);
  assert.equal(product?.kind, 'WORKFLOW_TOOL');
  assert.equal(product?.riskLevel, 'LOW');
  assert.equal(product?.requiresConfirmation, false);
  assert.ok(product?.inputSchema.steps.length);
  assert.ok(product?.outputSchema.steps.every((step) => step.outputContractId));
  assert.ok(expandWorkflowTool('workflow:product-ready'));
});

test('schedule runtime creates idempotent schedule events and enforces due state', async () => {
  const {
    evaluateSchedule,
    createScheduleEvent,
    parseScheduleDefinition,
  } = await import('../src/lib/agent/schedule-runtime.ts');

  const schedule = parseScheduleDefinition({
    version: 1,
    scheduleId: 'daily-report',
    kind: 'INTERVAL',
    eventType: 'job.report',
    enabled: true,
    timezone: 'Africa/Cairo',
    intervalMs: 60_000,
    payload: { job: 'report' },
  });

  const first = evaluateSchedule(schedule, new Date('2026-09-27T00:00:00.000Z'));
  assert.equal(first.due, true);

  const lastRun = '2026-09-27T00:00:00.000Z';
  const later = evaluateSchedule(schedule, new Date('2026-09-27T00:01:01.000Z'), lastRun);
  assert.equal(later.due, true);

  const event = createScheduleEvent(schedule, {
    taskId: 'scheduled-task',
    occurredAt: '2026-09-27T00:01:00.000Z',
  });
  assert.equal(event.source, 'SCHEDULE');
  assert.equal(event.taskId, 'scheduled-task');
  assert.equal(event.payload.scheduleId, 'daily-report');
  assert.equal(event.idempotencyKey, 'schedule:daily-report:2026-09-27T00:01:00');
});

test('universal ingestion pipeline preserves stage order and enforces output budgets', async () => {
  const {
    createIngestionEnvelope,
    runIngestionPipeline,
  } = await import('../src/lib/agent/ingestion-runtime.ts');

  const envelope = createIngestionEnvelope({
    ingestionId: 'ingest-1',
    source: 'USER_FILE',
    sourceRef: 'file-1',
    mediaType: 'image/png',
    bytes: 1024,
  });

  const pipeline = await runIngestionPipeline(envelope, 'raw', {
    normalize: (input) => String(input).trim(),
    filter: (input) => String(input).toUpperCase(),
    understand: (input) => ({ text: input }),
    transform: (input) => ({ ...input as { text: string }, ready: true }),
    verify: (input) => ({ ...input as { text: string; ready: boolean }, verified: true }),
    deliver: (input) => ({ ...input as { text: string; ready: boolean; verified: boolean }, delivered: true }),
  });

  assert.deepEqual(
    pipeline.artifacts.map((artifact) => artifact.stage),
    ['INGEST', 'NORMALIZE', 'FILTER', 'UNDERSTAND', 'TRANSFORM', 'VERIFY', 'DELIVER'],
  );
  assert.equal((pipeline.finalValue as { delivered: boolean }).delivered, true);
  await assert.rejects(
    () => runIngestionPipeline(envelope, 'x'.repeat(2_000), { maxOutputBytes: 64 }),
    /INGESTION_OUTPUT_BUDGET_EXCEEDED/,
  );
});

test('durable replay contract is additive and does not change canonical task authority', async () => {
  const module = await import('../src/server/agent/durable-task-store.ts');
  assert.equal(typeof module.getAgentTaskReplay, 'function');
  assert.equal(typeof module.listAgentTaskEvents, 'function');
  assert.equal(module.isDurableAgentTaskStoreConfigured(), Boolean(process.env.SUPABASE_URL?.trim() && (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())));
});
