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

let readCount = 0;
globalThis.fetch = async (input) => {
  const url = String(input);
  assert.match(url, /flix_admin_evidence/);
  readCount += 1;
  const expired = readCount > 1;
  const row = expired
    ? { ...evidence, expires_at: new Date(Date.now() - 60_000).toISOString() }
    : evidence;
  return new Response(JSON.stringify([row]), { status: 200 });
};

const fresh = await persistence.getLatestEvidenceForAssertion(evidence.assertion_id);
assert.equal(fresh?.status, 'VERIFIED');
assert.equal(readCount, 1);

const stale = await persistence.getLatestEvidenceForAssertion(evidence.assertion_id);
assert.equal(stale?.status, 'STALE');
console.log('ADMIN phase-2 role/freshness contract tests: PASS');
