import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/persistence.ts');
assert.equal(module.isPersistenceConfigured(), true);

const eventId = '11111111-1111-4111-8111-111111111111';
let calls = 0;
let postedBody = null;
const storedEvent = {
  id: eventId,
  event_type: 'unmet_request',
  visitor_id: 'visitor-1234',
  path: '/admin',
  locale: 'en',
  tool_id: 'ADMIN-002-PROOF',
  success: true,
  duration_ms: 7,
  context: 'ADMIN-002 test round-trip',
  metadata: { proof: 'ADMIN-002', marker: 'round-trip' },
  occurred_at: '2026-09-13T00:00:00.000Z',
  created_at: '2026-09-13T00:00:00.000Z',
};

globalThis.fetch = async (input, init = {}) => {
  calls += 1;
  const url = String(input);
  const headers = new Headers(init.headers);
  assert.equal(headers.get('apikey'), 'test-secret');
  assert.equal(headers.get('authorization'), null);

  if (String(init.method ?? 'GET') === 'POST') {
    assert.equal(url, 'https://example.supabase.co/rest/v1/flix_events');
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('prefer'), 'return=representation');
    postedBody = JSON.parse(String(init.body));
    return new Response(JSON.stringify([{ ...postedBody, ...storedEvent, metadata: postedBody.metadata }]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }

  assert.match(url, /\/rest\/v1\/flix_events\?id=eq\.11111111-1111-4111-8111-111111111111&select=\*$/);
  return new Response(JSON.stringify([{ ...storedEvent, metadata: postedBody?.metadata ?? storedEvent.metadata }]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const input = {
  event_type: 'unmet_request',
  visitor_id: 'visitor-1234',
  path: '/admin',
  locale: 'en',
  tool_id: 'ADMIN-002-PROOF',
  success: true,
  duration_ms: 7,
  context: 'ADMIN-002 test round-trip',
  metadata: { proof: 'ADMIN-002', marker: 'round-trip' },
};

const result = await module.assertEventRoundTrip(input);

assert.deepEqual(postedBody, input);
assert.equal(result.created.id, eventId);
assert.equal(result.readBack.id, eventId);
assert.equal(result.readBack.event_type, input.event_type);
assert.equal(result.readBack.visitor_id, input.visitor_id);
assert.equal(result.readBack.path, input.path);
assert.equal(result.readBack.locale, input.locale);
assert.equal(result.readBack.tool_id, input.tool_id);
assert.equal(result.readBack.success, input.success);
assert.equal(result.readBack.duration_ms, input.duration_ms);
assert.equal(result.readBack.context, input.context);
assert.deepEqual(result.readBack.metadata, input.metadata);
assert.equal(calls, 2);
console.log('ADMIN persistence adapter test: PASS');
