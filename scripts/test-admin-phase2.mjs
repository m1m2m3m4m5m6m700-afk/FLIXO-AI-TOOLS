import assert from 'node:assert/strict';

process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';

const roles = await import('../src/lib/admin/roles.ts');
assert.deepEqual(
  roles.activeCapabilitiesForRole('OWNER').includes('production.write'),
  false,
);
assert.equal(roles.activeCapabilitiesForRole('OWNER').includes('evidence.read'), true);
assert.equal(roles.activeCapabilitiesForRole('AUDITOR').includes('production.write'), false);

const persistence = await import('../api/admin/persistence.ts');
const canonical = await import('../api/admin/canonical.ts');
const now = new Date().toISOString();
const evidence = {
  evidence_id: '44444444-4444-4444-8444-444444444444',
  assertion_id: 'ADMIN-006-FRESHNESS',
  claim_id: 'ADMIN-006-FRESHNESS-CLAIM',
  exact_sha: '0123456789abcdef0123456789abcdef01234567',
  source: 'test-source',
  evaluator: 'phase2-test',
  environment: 'test',
  status: 'VERIFIED',
  freshness_at: now,
  recorded_at: now,
  payload: { marker: 'phase2' },
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  created_at: now,
};
evidence.integrity_sha256 = canonical.integritySha256({
  assertion_id: evidence.assertion_id,
  claim_id: evidence.claim_id,
  exact_sha: evidence.exact_sha,
  source: evidence.source,
  evaluator: evidence.evaluator,
  environment: evidence.environment,
  status: evidence.status,
  freshness_at: canonical.canonicalTimestamp(evidence.freshness_at),
  payload: evidence.payload,
  expires_at: canonical.canonicalTimestamp(evidence.expires_at),
});

const makeEvidence = (expiresAt) => {
  const row = { ...evidence, expires_at: expiresAt };
  row.integrity_sha256 = canonical.integritySha256({
    assertion_id: row.assertion_id,
    claim_id: row.claim_id,
    exact_sha: row.exact_sha,
    source: row.source,
    evaluator: row.evaluator,
    environment: row.environment,
    status: row.status,
    freshness_at: canonical.canonicalTimestamp(row.freshness_at),
    payload: row.payload,
    expires_at: canonical.canonicalTimestamp(row.expires_at),
  });
  return row;
};

let readCount = 0;
const audit = {
  event_id: '55555555-5555-4555-8555-555555555555',
  actor_subject: 'owner',
  actor_role: 'OWNER',
  action: 'evidence.recorded',
  capability: 'audit.read',
  target_type: 'evidence',
  target_id: evidence.evidence_id,
  exact_sha: evidence.exact_sha,
  environment: 'test',
  outcome: 'ALLOW',
  correlation_id: 'phase2-audit',
  evidence_id: evidence.evidence_id,
  occurred_at: now,
  metadata: { marker: 'phase2-audit' },
  created_at: now,
};
audit.integrity_sha256 = canonical.integritySha256({
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

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/flix_admin_audit_events?')) {
    return new Response(JSON.stringify([audit]), { status: 200 });
  }
  assert.match(url, /flix_admin_evidence/);
  readCount += 1;
  const row = makeEvidence(readCount === 1
    ? new Date(Date.now() + 60_000).toISOString()
    : new Date(Date.now() - 60_000).toISOString());
  return new Response(JSON.stringify([row]), { status: 200 });
};

const fresh = await persistence.getLatestEvidenceForAssertion(evidence.assertion_id);
assert.equal(fresh?.status, 'VERIFIED');
assert.equal(readCount, 1);

const stale = await persistence.getLatestEvidenceForAssertion(evidence.assertion_id);
assert.equal(stale?.status, 'STALE');
const auditReadBack = await persistence.getLatestAuditForEvidence(evidence.evidence_id);
assert.equal(auditReadBack?.evidence_id, evidence.evidence_id);
assert.equal(auditReadBack?.correlation_id, 'phase2-audit');
console.log('ADMIN phase-2 role/freshness/audit-link contract tests: PASS');
