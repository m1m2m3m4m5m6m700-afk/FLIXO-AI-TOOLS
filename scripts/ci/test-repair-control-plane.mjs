import assert from 'node:assert/strict';
import {
  REPAIR_STATES,
  CIRCUIT_BREAKER,
  createRepairCycle,
  deriveRepairIdentity,
  claimRepairCycle,
  transitionRepairCycle,
  recordStrategyAttempt,
  assertClosure,
  LEASE_STATES,
  REPAIR_OUTCOMES,
  deriveLeaseEventRef,
  deriveRecoveryRef,
  evaluateNoProgress,
  staleRecoveryDecision,
  controlPlaneSchema,
} from './repair-control-plane.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const FAILURE = 'f'.repeat(64);

const identity = deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: 'target-1', branch: 'execution' });
assert.match(identity.repairChainId, /^RC-[a-f0-9]{20}$/);
assert.equal(identity.cycleKey, `execution:${SHA_A}:${FAILURE}:target-1`);
assert.match(identity.leaseRef, /^refs\/tags\/flixo-repair-lease-[a-f0-9]{64}$/);
assert.equal(identity.claimKey, `claim-${identity.leaseRef.slice('refs/tags/flixo-repair-lease-'.length)}`);
const identityVariants = [
  { failureFingerprint: FAILURE, failedSha: SHA_B, targetRunId: 'target-1', branch: 'execution' },
  { failureFingerprint: 'e'.repeat(64), failedSha: SHA_A, targetRunId: 'target-1', branch: 'execution' },
  { failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: 'target-2', branch: 'execution' },
  { failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: 'target-1', branch: 'main' },
];
for (const variant of identityVariants) {
  const other = deriveRepairIdentity(variant);
  assert.notEqual(other.claimKey, identity.claimKey);
  assert.notEqual(other.leaseRef, identity.leaseRef);
}
const schema = controlPlaneSchema();
for (const invariant of [
  'GLOBAL_REPAIR_LEASE_IS_ATOMIC_AND_DURABLE',
  'GLOBAL_REPAIR_LEASE_IS_HTTP_STATUS_DRIVEN',
  'GLOBAL_REPAIR_LEASE_IS_NOT_A_BRANCH',
  'REPAIR_IDENTITY_HAS_ONE_CANONICAL_SOURCE',
  'STALE_LEASE_REQUIRES_ACTIVE_SESSION_AND_SHA_GATES',
  'NO_PROGRESS_REQUIRES_SAME_REPAIR_KEY_NO_EXIT_SHA_CHANGE_AND_NO_VERIFICATION_PROGRESS',
]) assert(schema.invariants.includes(invariant));


const progressOutcomes = [
  { repairKey: identity.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:03:00Z' },
  { repairKey: identity.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:02:00Z' },
  { repairKey: identity.claimKey, failedSha: SHA_A, exitSha: SHA_A, verificationProgress: false, noProgress: true, at: '2026-09-19T00:01:00Z' },
];
const noProgress = evaluateNoProgress({ repairKey: identity.claimKey, outcomes: progressOutcomes });
assert.equal(noProgress.consecutiveNoProgress, 3);
assert.equal(noProgress.circuitOpen, true);
const stale = staleRecoveryDecision({
  repairKey: identity.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00Z',
  now: Date.parse('2026-09-19T00:00:00Z'),
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [],
  outcomes: [],
});
assert.equal(stale.eligible, true);
const activeStale = staleRecoveryDecision({
  repairKey: identity.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00Z',
  now: Date.parse('2026-09-19T00:00:00Z'),
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [{ databaseId: '1', status: 'in_progress' }],
  outcomes: [],
});
assert.equal(activeStale.eligible, false);
assert(activeStale.reasons.includes('ACTIVE_REPAIR_SESSION_PRESENT'));

const detected = createRepairCycle({
  failureFingerprint: FAILURE,
  failedSha: SHA_A,
  targetRunId: '123456789',
  executionSha: SHA_A,
});
assert.equal(detected.state, 'DETECTED');
assert.deepEqual(REPAIR_STATES.slice(0, 4), ['DETECTED', 'CLAIMED', 'EVIDENCE_LOCKED', 'RCA']);

const claimed = claimRepairCycle(detected, { owner: 'WATCHER' });
assert.equal(claimed.state, 'CLAIMED');
assert.equal(claimed.owner, 'WATCHER');

const evidenced = transitionRepairCycle(claimed, 'EVIDENCE_LOCKED', { actor: 'WATCHER', reason: 'EVIDENCE_CAPTURED' });
const rca = transitionRepairCycle(evidenced, 'RCA', { actor: 'INVESTIGATOR', reason: 'ROOT_CAUSE_ANALYSIS' });
const planned = transitionRepairCycle(rca, 'REPAIR_PLANNED', { actor: 'TASK_AGENT', reason: 'ALLOW_BOUNDED_MUTATION' });
const mutating = transitionRepairCycle(planned, 'MUTATING', { actor: 'TASK_AGENT', reason: 'SOURCE_CORRECTION' });
const local = transitionRepairCycle(mutating, 'LOCAL_VERIFICATION', { actor: 'VERIFIER', reason: 'TARGETED_REGRESSION_PASS' });
const published = transitionRepairCycle(local, 'PUBLISHED_TO_EXECUTION', { actor: 'TASK_AGENT', reason: 'EXACT_SHA_PUBLISHED' });
const canonical = transitionRepairCycle(published, 'CANONICAL_CI', { actor: 'WATCHER', reason: 'CANONICAL_CI_STARTED' });
const green = transitionRepairCycle(canonical, 'GREEN', { actor: 'CANONICAL_CI', reason: 'ALL_REQUIRED_CHECKS_GREEN' });
const promotion = transitionRepairCycle(green, 'PROMOTION', { actor: 'PROMOTION_GATE', reason: 'PROMOTION_AUTHORIZED' });
assertClosure(promotion, {
  canonicalGreen: true,
  zeroRedChecks: true,
  freshExactShaEvidence: true,
  regressionProof: true,
  noUnprocessedActionableRed: true,
});
const closed = transitionRepairCycle(promotion, 'CLOSED', { actor: 'PROMOTION_GATE', reason: 'CLOSED_VERIFIED' });
assert.equal(closed.state, 'CLOSED');

assert.throws(() => transitionRepairCycle(detected, 'RCA'), /CONTROL_PLANE_INVALID_TRANSITION/);
assert.throws(() => transitionRepairCycle(canonical, 'PROMOTION'), /CONTROL_PLANE_INVALID_TRANSITION/);
assert.throws(() => transitionRepairCycle(green, 'CLOSED'), /CONTROL_PLANE_INVALID_TRANSITION/);

const redAgain = transitionRepairCycle(canonical, 'RED_AGAIN', { actor: 'CANONICAL_CI', reason: 'NEW_RED' });
const reopened = transitionRepairCycle(redAgain, 'RCA', { actor: 'INVESTIGATOR', reason: 'SAME_CYCLE_REOPEN' });
assert.equal(reopened.state, 'RCA');

const firstAttempt = recordStrategyAttempt(reopened, { strategy: 'A', progress: false });
const secondAttempt = recordStrategyAttempt(firstAttempt, { strategy: 'B', progress: false });
assert.equal(secondAttempt.stalledCycles, 2);
assert.throws(() => recordStrategyAttempt(secondAttempt, { strategy: 'C', progress: false }), /CONTROL_PLANE_CIRCUIT_BREAKER_OPEN/);
const recovered = recordStrategyAttempt(secondAttempt, { strategy: 'C', progress: true });
assert.equal(recovered.stalledCycles, 0);

assert.throws(() => createRepairCycle({
  failureFingerprint: FAILURE,
  failedSha: 'not-a-sha',
  targetRunId: '1',
  executionSha: SHA_A,
}), /CONTROL_PLANE_FAILED_SHA_INVALID/);

assert.throws(() => createRepairCycle({
  failureFingerprint: FAILURE,
  failedSha: SHA_A,
  targetRunId: '2',
  executionSha: SHA_B,
  observedBranch: 'main',
}), /CONTROL_PLANE_REPAIR_BRANCH_BLOCKED/);

assert.equal(CIRCUIT_BREAKER.failClosed, true);
const advanced = transitionRepairCycle(claimed, 'EVIDENCE_LOCKED', { actor: 'WATCHER', reason: 'CLI_ADVANCE_TEST' });
assert.equal(advanced.events.at(-1).to, 'EVIDENCE_LOCKED');
console.log('REPAIR_CONTROL_PLANE=PASS');
