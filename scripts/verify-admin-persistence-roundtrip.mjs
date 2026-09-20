import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const origin = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const environment = process.env.ADMIN_PERSISTENCE_ENVIRONMENT || '';
const expectedSha = process.env.EXPECTED_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

if (!origin || !serviceKey) {
  console.log('ADMIN persistence remote round-trip: BLOCKED (Supabase credentials unavailable)');
  process.exit(2);
}
if (!['test', 'staging', 'non-production'].includes(environment)) {
  console.error('ADMIN persistence remote round-trip: BLOCKED (ADMIN_PERSISTENCE_ENVIRONMENT must be test/staging/non-production)');
  process.exit(2);
}
assert.match(expectedSha, /^[0-9a-f]{40}$/);

const { assertAdminEvidenceRoundTrip } = await import('../api/admin/persistence.ts');

process.env.SUPABASE_URL = origin;
if (process.env.SUPABASE_SECRET_KEY) process.env.SUPABASE_SECRET_KEY = serviceKey;
else process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

const marker = `admin-006-${Date.now()}-${randomUUID()}`;
const evidenceId = randomUUID();
const correlationId = randomUUID();
const now = new Date().toISOString();

const evidenceInput = {
  assertion_id: 'ADMIN-006-PERSISTENCE-ROUNDTRIP',
  claim_id: 'ADMIN-006-PRODUCTION-FACING-EVIDENCE',
  exact_sha: expectedSha,
  source: 'supabase-remote-roundtrip',
  evaluator: 'verify-admin-persistence-roundtrip',
  environment,
  status: 'VERIFIED',
  freshness_at: now,
  payload: { marker, evidence_id: evidenceId },
  expires_at: null,
};

const auditInput = {
  actor_subject: 'admin-verifier',
  actor_role: 'admin',
  action: 'evidence.recorded',
  capability: 'admin.evidence.write',
  target_type: 'evidence',
  target_id: evidenceId,
  exact_sha: expectedSha,
  environment,
  outcome: 'ALLOW',
  correlation_id: correlationId,
  evidence_id: evidenceId,
  metadata: { marker, verifier: 'ADMIN-006' },
};

try {
  const result = await assertAdminEvidenceRoundTrip(evidenceInput, auditInput);
  assert.equal(result.evidenceReadBack.exact_sha, expectedSha);
  assert.equal(result.evidenceReadBack.environment, environment);
  assert.equal(result.evidenceReadBack.payload.marker, marker);
  assert.equal(result.auditReadBack.evidence_id, result.evidenceReadBack.evidence_id);
  assert.equal(result.auditReadBack.target_id, result.evidenceReadBack.evidence_id);
  assert.equal(result.auditReadBack.exact_sha, expectedSha);
  assert.equal(result.auditReadBack.environment, environment);
  assert.equal(result.auditReadBack.correlation_id, correlationId);
  assert.equal(result.auditReadBack.metadata.marker, marker);
  assert.match(result.evidenceReadBack.integrity_sha256, /^[0-9a-f]{64}$/);
  assert.match(result.auditReadBack.integrity_sha256, /^[0-9a-f]{64}$/);
  console.log(JSON.stringify({
    verdict: 'VERIFIED',
    task: 'ADMIN-006',
    exactSha: expectedSha,
    environment,
    evidenceId: result.evidenceReadBack.evidence_id,
    auditEventId: result.auditReadBack.event_id,
    correlationId,
    freshnessAt: now,
  }));
} catch (error) {
  console.error(`ADMIN persistence remote round-trip: FAILED (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}
