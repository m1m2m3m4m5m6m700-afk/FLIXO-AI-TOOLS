import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  createBrowserObservationCapability,
  BrowserObservationInputSchema,
  isCurrentBrowserObservation,
  normalizeBrowserObservationUrl,
} = await import('../src/lib/agent/browser-observation.ts');
const { invokeMcpCapability } = await import('../src/lib/agent/mcp-gateway.ts');

const sha = 'a'.repeat(40);

function observation(overrides = {}) {
  return {
    schemaVersion: 1,
    taskId: 'task-browser',
    traceId: 'trace-browser',
    exactSha: sha,
    url: 'https://flixoai.vercel.app/ar?volatile=1',
    capturedAt: '2026-09-27T00:00:00.000Z',
    status: 'clean',
    document: {
      title: 'FLIXO',
      lang: 'ar',
      dir: 'rtl',
      readyState: 'complete',
      mainCount: 1,
      h1Count: 1,
    },
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    failedResponses: [],
    performance: {
      domContentLoadedMs: 120,
      loadEventMs: 180,
      firstContentfulPaintMs: 90,
      resourceCount: 14,
    },
    ...overrides,
  };
}

test('browser observation capability is read-only and exact-SHA bound', async () => {
  const input = BrowserObservationInputSchema.parse({
    taskId: 'task-browser',
    traceId: 'trace-browser',
    expectedSha: sha,
    url: 'https://flixoai.vercel.app/ar?request=1',
  });

  const capability = createBrowserObservationCapability(async () => observation());
  assert.equal(capability.permission, 'READ');
  assert.equal(capability.kind, 'BROWSER_OBSERVATION');

  const result = await invokeMcpCapability(capability, input, { actorTrust: 'CORE' });
  assert.equal(result.audit.outcome, 'SUCCESS');
  assert.ok(result.output);
  assert.equal(isCurrentBrowserObservation(result.output!, input), true);
});

test('browser observation rejects stale SHA evidence', async () => {
  const capability = createBrowserObservationCapability(async () => observation({ exactSha: 'b'.repeat(40) }));
  const result = await invokeMcpCapability(capability, {
    taskId: 'task-browser',
    traceId: 'trace-browser',
    expectedSha: sha,
    url: 'https://flixoai.vercel.app/ar',
  }, { actorTrust: 'CORE' });

  assert.equal(result.output, undefined);
  assert.equal(result.audit.outcome, 'FAILURE');
  assert.match(result.audit.reason ?? '', /MCP_OUTPUT_VERIFICATION_FAILED/);
});

test('observation URLs normalize transient query and fragment state', () => {
  assert.equal(
    normalizeBrowserObservationUrl('https://flixoai.vercel.app/ar?trace=1#result'),
    'https://flixoai.vercel.app/ar',
  );
});
