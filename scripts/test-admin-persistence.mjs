import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/persistence.ts');
assert.equal(module.isPersistenceConfigured(), true);

const eventId = '11111111-1111-4111-8111-111111111111';
let calls = 0;
globalThis.fetch = async (input, init = {}) => {
  calls += 1;
  const url = String(input);
  const headers = new Headers(init.headers);
  assert.equal(headers.get('apikey'), 'test-secret');
  assert.equal(headers.get('authorization'), null);

  if (String(init.method ?? 'GET') === 'POST') {
    assert.equal(url, 'https://example.supabase.co/rest/v1/flix_events');
    return new Response(JSON.stringify([{ id: eventId, event_type: 'unmet_request', visitor_id: 'visitor-1234', path: '/admin', locale: 'en', metadata: {}, occurred_at: '2026-09-13T00:00:00.000Z', created_at: '2026-09-13T00:00:00.000Z' }]), { status: 201, headers: { 'content-type': 'application/json' } });
  }

  assert.match(url, /\/rest\/v1\/flix_events\?id=eq\.11111111-1111-4111-8111-111111111111&select=\*$/);
  return new Response(JSON.stringify([{ id: eventId, event_type: 'unmet_request', visitor_id: 'visitor-1234', path: '/admin', locale: 'en', metadata: {}, occurred_at: '2026-09-13T00:00:00.000Z', created_at: '2026-09-13T00:00:00.000Z' }]), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await module.assertEventRoundTrip({
  event_type: 'unmet_request',
  visitor_id: 'visitor-1234',
  path: '/admin',
  locale: 'en',
});

assert.equal(result.created.id, eventId);
assert.equal(result.readBack.id, eventId);
assert.equal(calls, 2);
console.log('ADMIN persistence adapter test: PASS');
