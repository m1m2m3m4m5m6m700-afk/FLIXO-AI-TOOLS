import assert from 'node:assert/strict';
import { integritySha256 } from '../api/admin/canonical.ts';

process.env.SUPABASE_SECRET_KEY = 'contract-test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const persistence = await import('../api/admin/persistence.ts');

const evidenceId = '22222222-2222-4222-8222-222222222222';
const auditId = '33333333-3333-4333-8333-333333333333';
const exactSha = '0123456789abcdef0123456789abcdef01234567';

const evidence = {
  evidence_id: evidenceId,
  assertion_id: 'ADMIN-006-CONTRACT',
  claim_id: 'ADMIN-006-PROOF',
  exact_sha: exactSha,
  source: 'server-contract-test',
  evaluator: 'verify-admin-persistence-contract',
  environment: 'non-production-test',
  status: 'VERIFIED',
  freshness_at: '2026-09-15T00:00:00.000Z',
  recorded_at: '2026-09-15T00:00:00.000Z',
  payload: { marker: 'admin-006-contract' },
  expires_at: null,
  created_at: '2026-09-15T00:00:00.000Z',
};
evidence.integrity_sha256 = integritySha256({
  assertion_id: evidence.assertion_id,
  claim_id: evidence.claim_id,
  exact_sha: evidence.exact_sha,
  source: evidence.source,
  evaluator: evidence.evaluator,
  environment: evidence.environment,
  status: evidence.status,
  freshness_at: evidence.freshness_at,
  payload: evidence.payload,
  expires_at: evidence.expires_at,
});

const audit = {
  event_id: auditId,
  actor_subject: 'admin-contract-test',
  actor_role: 'admin',
  action: 'evidence.recorded',
  capability: 'admin.evidence.write',
  target_type: 'evidence',
  target_id: evidenceId,
  exact_sha: exactSha,
  environment: 'non-production-test',
  outcome: 'ALLOW',
  correlation_id: 'admin-006-contract-correlation',
  evidence_id: evidenceId,
  occurred_at: '2026-09-15T00:00:00.000Z',
  metadata: { marker: 'admin-006-audit' },
  created_at: '2026-09-15T00:00:00.000Z',
};
audit.integrity_sha256 = integritySha256({
  actor_subject: audit.actor_subject,
  actor_role: audit.actor_role,
  action: audit.action,
  capability: audit.capability,
  target_type: audit.target_type,
  target_id: audit.target_id,
  exact_sha: audit.exact_sha,
  environment: audit.environment,
  outcome: audit.outcome,
  correlation_id: audit.correlation_id,
  evidence_id: audit.evidence_id,
  metadata: audit.metadata,
});

const posted = { evidence: null, audit: null };
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = String(init.method ?? 'GET');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('apikey'), 'contract-test-secret');
  assert.equal(headers.get('authorization'), 'Bearer contract-test-secret');

  if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_evidence')) {
    posted.evidence = JSON.parse(String(init.body));
    return new Response(JSON.stringify([{ ...posted.evidence, ...evidence }]), { status: 201 });
  }
  if (method === 'GET' && url.includes('/rest/v1/flix_admin_evidence?evidence_id=eq.')) {
    return new Response(JSON.stringify([evidence]), { status: 200 });
  }
  if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_audit_events')) {
    posted.audit = JSON.parse(String(init.body));
    return new Response(JSON.stringify([{ ...posted.audit, ...audit }]), { status: 201 });
  }
  if (method === 'GET' && url.includes('/rest/v1/flix_admin_audit_events?event_id=eq.')) {
    return new Response(JSON.stringify([audit]), { status: 200 });
  }
  throw new Error(`unexpected request: ${method} ${url}`);
};

const input = {
  assertion_id: evidence.assertion_id,
  claim_id: evidence.claim_id,
  exact_sha: evidence.exact_sha,
  source: evidence.source,
  evaluator: evidence.evaluator,
  environment: evidence.environment,
  status: evidence.status,
  freshness_at: evidence.freshness_at,
  payload: evidence.payload,
  expires_at: null,
};
const auditInput = {
  actor_subject: audit.actor_subject,
  actor_role: audit.actor_role,
  action: audit.action,
  capability: audit.capability,
  target_type: audit.target_type,
  target_id: audit.target_id,
  exact_sha: audit.exact_sha,
  environment: audit.environment,
  outcome: audit.outcome,
  correlation_id: audit.correlation_id,
  metadata: audit.metadata,
};

const result = await persistence.assertAdminEvidenceRoundTrip(input, auditInput);
assert.equal(result.evidenceReadBack.evidence_id, evidenceId);
assert.equal(result.auditReadBack.evidence_id, evidenceId);
assert.equal(result.evidenceReadBack.exact_sha, exactSha);
assert.equal(result.auditReadBack.exact_sha, exactSha);
assert.equal(result.evidenceReadBack.integrity_sha256, evidence.integrity_sha256);
assert.equal(result.auditReadBack.integrity_sha256, audit.integrity_sha256);
assert.equal(posted.evidence.integrity_sha256, evidence.integrity_sha256);
assert.equal(posted.audit.integrity_sha256, audit.integrity_sha256);

console.log('ADMIN persistence contract round-trip: PASS');
console.log(`EVIDENCE_ID=${evidenceId}`);
console.log(`AUDIT_EVENT_ID=${auditId}`);
console.log(`EXACT_SHA=${exactSha}`);
console.log('PRODUCTION_MUTATION=DISABLED');
