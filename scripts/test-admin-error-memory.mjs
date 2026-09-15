import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/error-memory.ts');
const errors = [
  { id: '11111111-1111-4111-8111-111111111111', event_type: 'execution_error', occurred_at: '2026-09-15T10:00:00.000Z', error_code: 'IMAGE_DECODE_FAILED' },
  { id: '22222222-2222-4222-8222-222222222222', event_type: 'execution_error', occurred_at: '2026-09-15T09:00:00.000Z', error_code: 'MODEL_TIMEOUT' },
  { id: 'bad', event_type: 'tool_usage', occurred_at: '2026-09-15T08:00:00.000Z' },
];
let requestedUrl = '';
globalThis.fetch = async (input, init = {}) => {
  requestedUrl = String(input);
  const headers = new Headers(init.headers);
  assert.equal(headers.get('apikey'), 'test-secret');
  assert.equal(headers.get('authorization'), 'Bearer test-secret');
  return new Response(JSON.stringify(errors), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await module.listExecutionErrors(2);
assert.equal(result.length, 2);
assert.equal(result[0].error_code, 'IMAGE_DECODE_FAILED');
assert.equal(result[1].error_code, 'MODEL_TIMEOUT');
assert.match(requestedUrl, /event_type=eq\.execution_error/);
assert.match(requestedUrl, /order=occurred_at\.desc/);
assert.match(requestedUrl, /limit=2/);

await assert.rejects(() => module.listExecutionErrors(0), /supabase_error_memory_invalid_limit/);
await assert.rejects(() => module.listExecutionErrors(101), /supabase_error_memory_invalid_limit/);
await assert.rejects(() => module.listExecutionErrors(1.5), /supabase_error_memory_invalid_limit/);

console.log('ADMIN error memory contract test: PASS (non-production)');
