import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const module = await import('../api/admin/persistence.ts');
const canonical = await import('../api/admin/canonical.ts');

const sha256 = canonical.integritySha256;
const canonicalTimestamp = canonical.canonicalTimestamp;
const expectedSha = process.env.EXPECTED_SHA?.trim() || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.match(expectedSha, /^[0-9a-f]{40}$/);
const freshnessAt = new Date().toISOString();
const evidenceId = '22222222-2222-4222-8222-222222222222';
const auditId = '33333333-3333-4333-8333-333333333333';

const evidence = {
  evidence_id: evidenceId,
  assertion_id: 'ADMIN-006-ROUNDTRIP', claim_id: 'ADMIN-006-PROOF', exact_sha: expectedSha, source: 'production-server', evaluator: 'admin-integrity-test', environment: 'production', status: 'VERIFIED', freshness_at: freshnessAt, recorded_at: freshnessAt, payload: { proof: 'ADMIN-006', marker: 'integrity' }, expires_at: null, created_at: freshnessAt,
};
evidence.integrity_sha256 = sha256({ assertion_id: evidence.assertion_id, claim_id: evidence.claim_id, exact_sha: evidence.exact_sha, source: evidence.source, evaluator: evidence.evaluator, environment: evidence.environment, status: evidence.status, freshness_at: canonicalTimestamp(evidence.freshness_at), payload: evidence.payload, expires_at: canonicalTimestamp(evidence.expires_at) });

const audit = {
  event_id: auditId,
  actor_subject: 'admin-user-1', actor_role: 'admin', action: 'evidence.recorded', capability: 'admin.evidence.write', target_type: 'evidence', target_id: evidenceId, exact_sha: evidence.exact_sha, environment: 'production', outcome: 'ALLOW', correlation_id: 'corr-integrity', evidence_id: evidenceId, occurred_at: freshnessAt, metadata: { proof: 'ADMIN-006', marker: 'integrity' }, created_at: freshnessAt,
};
audit.integrity_sha256 = sha256({ actor_subject: audit.actor_subject, actor_role: audit.actor_role, action: audit.action, capability: audit.capability, target_type: audit.target_type, target_id: audit.target_id, exact_sha: audit.exact_sha, environment: audit.environment, outcome: audit.outcome, correlation_id: audit.correlation_id, evidence_id: audit.evidence_id, metadata: audit.metadata });

let evidenceReadCount = 0;
let auditReadCount = 0;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/rest/v1/flix_admin_evidence?')) {
    evidenceReadCount += 1;
    if (evidenceReadCount === 1) return new Response(JSON.stringify([{ ...evidence }]), { status: 200 });
    return new Response(JSON.stringify([{ ...evidence, payload: { ...evidence.payload, marker: 'tampered' } }]), { status: 200 });
  }
  if (url.includes('/rest/v1/flix_admin_audit_events?')) {
    auditReadCount += 1;
    if (auditReadCount === 1) return new Response(JSON.stringify([{ ...audit }]), { status: 200 });
    return new Response(JSON.stringify([{ ...audit, outcome: 'DENY' }]), { status: 200 });
  }
  throw new Error(`unexpected request: ${url}`);
};

const evidenceReadBack = await module.getEvidence(evidenceId);
assert.equal(evidenceReadBack?.evidence_id, evidenceId);
assert.equal(evidenceReadBack?.integrity_sha256, evidence.integrity_sha256);
await assert.rejects(() => module.getEvidence(evidenceId), /supabase_evidence_integrity_failed/);

const auditReadBack = await module.getAuditEvent(auditId);
assert.equal(auditReadBack?.event_id, auditId);
assert.equal(auditReadBack?.integrity_sha256, audit.integrity_sha256);
await assert.rejects(() => module.getAuditEvent(auditId), /supabase_audit_integrity_failed/);

console.log(`ADMIN integrity read-back test: PASS (${expectedSha})`);
