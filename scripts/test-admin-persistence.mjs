import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/persistence.ts');
const canonical = await import('../api/admin/canonical.ts');
assert.equal(module.isPersistenceConfigured(), true);

const sha256 = canonical.integritySha256;

const eventId = '11111111-1111-4111-8111-111111111111';
const evidenceId = '22222222-2222-4222-8222-222222222222';
const auditId = '33333333-3333-4333-8333-333333333333';
let calls = 0;
let postedEvent = null;
let postedEvidence = null;
let postedAudit = null;

const storedEvent = {
  id: eventId,
  event_type: 'unmet_request',
  visitor_id: 'visitor-1234',
  path: '/admin',
  locale: 'en',
  tool_id: 'ADMIN-002-PROOF',
  success: true,
  duration_ms: 7,
  context: 'ADMIN-002 adapter contract test',
  metadata: { proof: 'ADMIN-002', marker: 'round-trip' },
  occurred_at: '2026-09-13T00:00:00.000Z',
  created_at: '2026-09-13T00:00:00.000Z',
};

const storedEvidence = {
  evidence_id: evidenceId,
  assertion_id: 'ADMIN-006-ROUNDTRIP',
  claim_id: 'ADMIN-006-PROOF',
  exact_sha: '6a5d1f52615e72113dda5ee7bfe3095cebfb8378',
  source: 'non-production-test-server',
  evaluator: 'admin-persistence-adapter-test',
  environment: 'test',
  status: 'VERIFIED',
  freshness_at: '2026-09-14T03:50:00.000Z',
  recorded_at: '2026-09-14T03:50:00.000Z',
  payload: { proof: 'ADMIN-006', marker: 'evidence-round-trip' },
  expires_at: null,
  created_at: '2026-09-14T03:50:00.000Z',
};
storedEvidence.integrity_sha256 = sha256({
  assertion_id: storedEvidence.assertion_id,
  claim_id: storedEvidence.claim_id,
  exact_sha: storedEvidence.exact_sha,
  source: storedEvidence.source,
  evaluator: storedEvidence.evaluator,
  environment: storedEvidence.environment,
  status: storedEvidence.status,
  freshness_at: storedEvidence.freshness_at,
  payload: storedEvidence.payload,
  expires_at: storedEvidence.expires_at,
});

const storedAudit = {
  event_id: auditId,
  actor_subject: 'admin-user-1',
  actor_role: 'admin',
  action: 'evidence.recorded',
  capability: 'admin.evidence.write',
  target_type: 'evidence',
  target_id: evidenceId,
  exact_sha: storedEvidence.exact_sha,
  environment: 'test',
  outcome: 'ALLOW',
  correlation_id: 'corr-123',
  evidence_id: evidenceId,
  occurred_at: '2026-09-14T03:50:00.000Z',
  metadata: { proof: 'ADMIN-006', marker: 'audit-round-trip' },
  created_at: '2026-09-14T03:50:00.000Z',
};
storedAudit.integrity_sha256 = sha256({
  actor_subject: storedAudit.actor_subject,
  actor_role: storedAudit.actor_role,
  action: storedAudit.action,
  capability: storedAudit.capability,
  target_type: storedAudit.target_type,
  target_id: storedAudit.target_id,
  exact_sha: storedAudit.exact_sha,
  environment: storedAudit.environment,
  outcome: storedAudit.outcome,
  correlation_id: storedAudit.correlation_id,
  evidence_id: storedAudit.evidence_id,
  metadata: storedAudit.metadata,
});

globalThis.fetch = async (input, init = {}) => {
  calls += 1;
  const url = String(input);
  const headers = new Headers(init.headers);
  assert.equal(headers.get('apikey'), 'test-secret');
  assert.equal(headers.get('authorization'), 'Bearer test-secret');

  const method = String(init.method ?? 'GET');
  if (method === 'POST' && url.endsWith('/rest/v1/flix_events')) {
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('prefer'), 'return=representation');
    postedEvent = JSON.parse(String(init.body));
    return new Response(JSON.stringify([{ ...postedEvent, ...storedEvent, metadata: postedEvent.metadata }]), { status: 201, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'GET' && /\/rest\/v1\/flix_events\?id=eq\./.test(url)) {
    return new Response(JSON.stringify([{ ...storedEvent, metadata: postedEvent?.metadata ?? storedEvent.metadata }]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_evidence')) {
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('prefer'), 'return=representation');
    postedEvidence = JSON.parse(String(init.body));
    assert.match(postedEvidence.integrity_sha256, /^[0-9a-f]{64}$/);
    return new Response(JSON.stringify([{ ...postedEvidence, evidence_id: evidenceId, ...storedEvidence }]), { status: 201, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'GET' && /\/rest\/v1\/flix_admin_evidence\?evidence_id=eq\./.test(url)) {
    return new Response(JSON.stringify([{ ...storedEvidence }]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_audit_events')) {
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('prefer'), 'return=representation');
    postedAudit = JSON.parse(String(init.body));
    assert.equal(postedAudit.evidence_id, evidenceId);
    assert.match(postedAudit.integrity_sha256, /^[0-9a-f]{64}$/);
    return new Response(JSON.stringify([{ ...postedAudit, event_id: auditId, ...storedAudit }]), { status: 201, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'GET' && /\/rest\/v1\/flix_admin_audit_events\?event_id=eq\./.test(url)) {
    return new Response(JSON.stringify([{ ...storedAudit }]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected request: ${method} ${url}`);
};

const eventInput = {
  event_type: 'unmet_request', visitor_id: 'visitor-1234', path: '/admin', locale: 'en', tool_id: 'ADMIN-002-PROOF', success: true, duration_ms: 7, context: 'ADMIN-002 adapter contract test', metadata: { proof: 'ADMIN-002', marker: 'round-trip' },
};
const eventResult = await module.assertEventRoundTrip(eventInput);
assert.deepEqual(postedEvent, eventInput);
assert.equal(eventResult.created.id, eventId);
assert.equal(eventResult.readBack.id, eventId);
assert.deepEqual(eventResult.readBack.metadata, eventInput.metadata);

const evidenceInput = {
  assertion_id: 'ADMIN-006-ROUNDTRIP', claim_id: 'ADMIN-006-PROOF', exact_sha: storedEvidence.exact_sha, source: 'non-production-test-server', evaluator: 'admin-persistence-adapter-test', environment: 'test', status: 'VERIFIED', freshness_at: storedEvidence.freshness_at, payload: { proof: 'ADMIN-006', marker: 'evidence-round-trip' }, expires_at: null,
};
const auditInput = {
  actor_subject: 'admin-user-1', actor_role: 'admin', action: 'evidence.recorded', capability: 'admin.evidence.write', target_type: 'evidence', target_id: evidenceId, exact_sha: storedEvidence.exact_sha, environment: 'test', outcome: 'ALLOW', correlation_id: 'corr-123', metadata: { proof: 'ADMIN-006', marker: 'audit-round-trip' },
};
const adminResult = await module.assertAdminEvidenceRoundTrip(evidenceInput, auditInput);
assert.equal(adminResult.evidence.evidence_id, evidenceId);
assert.equal(adminResult.evidenceReadBack.evidence_id, evidenceId);
assert.equal(adminResult.evidenceReadBack.exact_sha, evidenceInput.exact_sha);
assert.equal(adminResult.evidenceReadBack.integrity_sha256, storedEvidence.integrity_sha256);
assert.equal(adminResult.auditEvent.event_id, auditId);
assert.equal(adminResult.auditReadBack.event_id, auditId);
assert.equal(adminResult.auditReadBack.evidence_id, evidenceId);
assert.equal(adminResult.auditReadBack.integrity_sha256, storedAudit.integrity_sha256);
assert.equal(postedEvidence.integrity_sha256, storedEvidence.integrity_sha256);
assert.equal(postedAudit.integrity_sha256, storedAudit.integrity_sha256);
assert.equal(calls, 6);

const originalUrl = process.env.SUPABASE_URL;
const originalSecret = process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.equal(module.isPersistenceConfigured(), false);
await assert.rejects(() => module.probePersistence(), /supabase_persistence_not_configured/);
process.env.SUPABASE_URL = originalUrl;
process.env.SUPABASE_SECRET_KEY = originalSecret;

console.log('ADMIN persistence adapter contract test: PASS (non-production)');