import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/persistence.ts');

const errors = [
  { id: '11111111-1111-4111-8111-111111111111', event_type: 'execution_error', visitor_id: 'v-1', path: '/image-compressor', locale: 'ar', tool_id: 'image-compressor', success: false, error_code: 'IMAGE_DECODE_FAILED', message: 'decode failed', occurred_at: '2026-09-15T10:00:00.000Z', created_at: '2026-09-15T10:00:00.000Z', metadata: {} },
  { id: '22222222-2222-4222-8222-222222222222', event_type: 'execution_error', visitor_id: 'v-2', path: '/image-upscaler', locale: 'en', tool_id: 'image-upscaler', success: false, error_code: 'MODEL_TIMEOUT', message: 'model timeout', occurred_at: '2026-09-15T09:00:00.000Z', created_at: '2026-09-15T09:00:00.000Z', metadata: {} },
];
let requestedUrl = '';
globalThis.fetch = async (input) => {
  requestedUrl = String(input);
  return new Response(JSON.stringify(errors), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await module.listExecutionErrors(2);
assert.equal(result.length, 2);
assert.equal(result[0].event_type, 'execution_error');
assert.equal(result[0].error_code, 'IMAGE_DECODE_FAILED');
assert.match(requestedUrl, /event_type=eq\.execution_error/);
assert.match(requestedUrl, /order=occurred_at\.desc/);
assert.match(requestedUrl, /limit=2/);

await assert.rejects(() => module.listExecutionErrors(0), /supabase_invalid_error_memory_limit/);
await assert.rejects(() => module.listExecutionErrors(101), /supabase_invalid_error_memory_limit/);
await assert.rejects(() => module.listExecutionErrors(1.5), /supabase_invalid_error_memory_limit/);

console.log('ADMIN error memory contract test: PASS (non-production)');
