import assert from 'node:assert/strict';
import http from 'node:http';
import {
  deriveRepairIdentity,
  deriveLeaseEventRef,
  deriveRecoveryRef,
  evaluateNoProgress,
  staleRecoveryDecision,
} from './repair-control-plane.mjs';
import { createRefAtomically, statusDecision } from './repair-lease.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const FP_A = '1'.repeat(64);
const FP_B = '2'.repeat(64);

const base = deriveRepairIdentity({
  branch: 'execution',
  failedSha: SHA_A,
  failureFingerprint: FP_A,
  targetRunId: '100',
});
assert.match(base.leaseRef, /^refs\/tags\/flixo-repair-lease-[a-f0-9]{64}$/);
assert.match(base.recoveryRefPrefix, /^refs\/tags\/flixo-repair-lease-recovery-[a-f0-9]{64}$/);
assert.match(base.eventRefPrefix, /^refs\/tags\/flixo-repair-event-[a-f0-9]{64}$/);
assert.equal(base.cycleKey, `execution:${SHA_A}:${FP_A}:100`);

for (const [label, variant] of [
  ['sha', { failedSha: SHA_B, failureFingerprint: FP_A, targetRunId: '100', branch: 'execution' }],
  ['fingerprint', { failedSha: SHA_A, failureFingerprint: FP_B, targetRunId: '100', branch: 'execution' }],
  ['targetRunId', { failedSha: SHA_A, failureFingerprint: FP_A, targetRunId: '101', branch: 'execution' }],
  ['branch', { failedSha: SHA_A, failureFingerprint: FP_A, targetRunId: '100', branch: 'main' }],
]) {
  const next = deriveRepairIdentity(variant);
  assert.notEqual(next.claimKey, base.claimKey, `identity must change for ${label}`);
  assert.notEqual(next.leaseRef, base.leaseRef, `lease must change for ${label}`);
}

assert.match(deriveLeaseEventRef({ identity: base, eventType: 'STATE', eventId: '100' }), /^refs\/tags\/flixo-repair-event-/);
assert.match(deriveRecoveryRef({ identity: base, attempt: 2 }), /-2$/);

const outcomes = [
  { repairKey: base.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:03:00.000Z' },
  { repairKey: base.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:02:00.000Z' },
  { repairKey: base.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:01:00.000Z' },
];
const noProgress = evaluateNoProgress({ repairKey: base.claimKey, outcomes });
assert.equal(noProgress.consecutiveNoProgress, 3);
assert.equal(noProgress.circuitOpen, true);

const staleEligible = staleRecoveryDecision({
  repairKey: base.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00.000Z',
  now: Date.parse('2026-09-19T00:00:00.000Z'),
  staleAfterMs: 60 * 60 * 1000,
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [],
  outcomes: [],
});
assert.equal(staleEligible.eligible, true);

const staleBlockedByActive = staleRecoveryDecision({
  repairKey: base.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00.000Z',
  now: Date.parse('2026-09-19T00:00:00.000Z'),
  staleAfterMs: 60 * 60 * 1000,
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [{ databaseId: 77, status: 'in_progress' }],
  outcomes: [],
});
assert.equal(staleBlockedByActive.eligible, false);
assert(staleBlockedByActive.reasons.includes('ACTIVE_REPAIR_SESSION_PRESENT'));

const staleBlockedByProgress = staleRecoveryDecision({
  repairKey: base.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00.000Z',
  now: Date.parse('2026-09-19T00:00:00.000Z'),
  staleAfterMs: 60 * 60 * 1000,
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [],
  outcomes: [{ repairKey: base.claimKey, outcome: 'VERIFIED_REPAIR', failedSha: SHA_A, exitSha: SHA_B, verificationProgress: true, at: '2026-09-18T23:59:00.000Z' }],
});
assert.equal(staleBlockedByProgress.eligible, false);
assert(staleBlockedByProgress.reasons.includes('SUCCESSFUL_REPAIR_ALREADY_VERIFIED'));

for (const [status, expected] of [[201, 'ACQUIRED'], [422, 'ALREADY_CLAIMED'], [401, 'AUTH_FAILURE'], [403, 'AUTH_FAILURE'], [500, 'PROVIDER_FAILURE'], [429, 'FAIL_CLOSED']]) {
  assert.equal(statusDecision(status), expected);
}

const claimedRefs = new Set();
const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/repos/owner/repo/git/refs') {
    res.writeHead(404); res.end(); return;
  }
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const payload = JSON.parse(body);
    const key = payload.ref;
    if (claimedRefs.has(key)) {
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Reference already exists' }));
      return;
    }
    claimedRefs.add(key);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ref: key, object: { sha: payload.sha, type: 'tag' } }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const race = await Promise.all(Array.from({ length: 100 }, (_, worker) => createRefAtomically({
  apiRoot: `http://127.0.0.1:${port}`,
  repoName: 'owner/repo',
  authToken: 'test-token',
  refName: base.leaseRef,
  objectSha: SHA_A,
}).then((result) => ({ worker, decision: result.decision, status: result.status }))));

server.close();
assert.equal(race.filter((item) => item.decision === 'ACQUIRED').length, 1);
assert.equal(race.filter((item) => item.decision === 'ALREADY_CLAIMED').length, 99);
assert.equal(race.filter((item) => item.decision === 'ACQUIRED').length + race.filter((item) => item.decision === 'ALREADY_CLAIMED').length, 100);
assert.equal(claimedRefs.size, 1);
console.log('REPAIR_LEASE_CONTRACT=PASS');
