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
  evaluateNoProgress,
  staleRecoveryDecision,
  controlPlaneSchema,
  assertDispatchIdentity,
  assertExecutionHeadUnchanged,
  buildEvidenceProvenance,
  validateEvidenceProvenance,
  BROTHER_IDS,
  BROTHER_MODES,
  createBrotherSession,
  assertBrotherAuthority,
  surrenderBrother,
  recordBrotherChallenge,
} from './repair-control-plane.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const FAILURE = 'f'.repeat(64);

const identity = deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: 'target-1', branch: 'execution' });
assert.match(identity.repairChainId, /^RC-[a-f0-9]{20}$/);
assert.equal(identity.cycleKey, `execution:${SHA_A}:${FAILURE}:target-1`);
assert.equal(identity.dispatchKey, SHA_A + ':target-1:' + FAILURE);
assert.equal(assertDispatchIdentity({ dispatchKey: identity.dispatchKey }, { failedSha: SHA_A, targetRunId: 'target-1', failureFingerprint: FAILURE }), true);
assert.throws(() => assertDispatchIdentity({ dispatchKey: identity.dispatchKey }, { failedSha: SHA_B, targetRunId: 'target-1', failureFingerprint: FAILURE }), /DISPATCH_IDENTITY_MISMATCH/);
assert.equal(assertExecutionHeadUnchanged({ expectedSha: SHA_A, currentSha: SHA_A }), true);
assert.throws(() => assertExecutionHeadUnchanged({ expectedSha: SHA_A, currentSha: SHA_B }), /HEAD_CHANGED/);
const provenance = buildEvidenceProvenance({ assertionId: 'ASSERT-001', executionUnit: 'job:test', sourceSha: SHA_A, runId: 'run-1', result: 'PASS', certificateId: 'CERT-001' });
assert.equal(validateEvidenceProvenance(provenance, { expectedSha: SHA_A, expectedCertificateId: 'CERT-001' }).valid, true);
assert.throws(() => validateEvidenceProvenance(provenance, { expectedSha: SHA_B }), /EVIDENCE_SHA_MISMATCH/);
assert.throws(() => validateEvidenceProvenance(provenance, { expectedSha: SHA_A, expectedCertificateId: 'CERT-002' }), /CERTIFICATE_ID_MISMATCH/);

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
assert.equal(stale.strategyRotationRequired, false);
const circuitStale = staleRecoveryDecision({
  repairKey: identity.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00Z',
  now: Date.parse('2026-09-19T00:00:00Z'),
  currentExecutionSha: SHA_A,
  failedSha: SHA_A,
  activeRuns: [],
  outcomes: progressOutcomes,
});
assert.equal(circuitStale.eligible, false);
assert.equal(circuitStale.strategyRotationRequired, true);

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

assert.deepEqual(BROTHER_IDS, ['A', 'B']);
assert.deepEqual(BROTHER_MODES, ['WRITE', 'READ']);
const brotherSession = createBrotherSession({
  repairChainId: identity.repairChainId,
  failureFingerprint: FAILURE,
  targetSha: SHA_A,
});
assert.equal(brotherSession.activeBrother, 'A');
assert.equal(brotherSession.activeMode, 'WRITE');
assert.equal(brotherSession.waitingBrother, 'B');
assert.equal(brotherSession.waitingMode, 'READ');
assert.equal(assertBrotherAuthority(brotherSession, { brotherId: 'A', mode: 'WRITE', mutation: true, targetSha: SHA_A }).mutation, true);
assert.equal(assertBrotherAuthority(brotherSession, { brotherId: 'B', mode: 'READ', mutation: false, targetSha: SHA_A }).readOnly, true);
assert.throws(() => assertBrotherAuthority(
  brotherSession,
  { brotherId: 'B', mode: 'READ', mutation: true, targetSha: SHA_A },
), /BROTHER_READ_ONLY_MUTATION_BLOCKED/);
assert.throws(() => assertBrotherAuthority(
  brotherSession,
  { brotherId: 'B', mode: 'WRITE', mutation: true, targetSha: SHA_A },
), /BROTHER_TURN_VIOLATION/);

const surrendered = surrenderBrother(brotherSession, {
  brotherId: 'A',
  reason: 'EXECUTOR_GAVE_UP',
  exitSha: SHA_A,
});
assert.equal(surrendered.activeBrother, 'B');
assert.equal(surrendered.activeMode, 'WRITE');
assert.equal(surrendered.waitingBrother, 'A');
assert.equal(surrendered.waitingMode, 'READ');
assert.equal(surrendered.handoffCount, 1);
assert.equal(surrendered.lastSurrender.fromMode, 'WRITE');
assert.equal(surrendered.lastSurrender.toMode, 'READ');
assert.equal(assertBrotherAuthority(surrendered, { brotherId: 'B', mode: 'WRITE', mutation: true, targetSha: SHA_A }).mutation, true);
assert.equal(assertBrotherAuthority(surrendered, { brotherId: 'A', mode: 'READ', mutation: false, targetSha: SHA_A }).readOnly, true);

const challenged = recordBrotherChallenge(surrendered, {
  brotherId: 'A',
  targetSha: SHA_A,
  disposition: 'STRONG_DISSENT',
  evidenceDigest: 'evidence-1',
});
assert.equal(challenged.nextAction, 'WAIT_FOR_ACTIVE_BROTHER_SURRENDER');
assert.equal(challenged.lastChallenge.brotherId, 'A');
assert.throws(() => recordBrotherChallenge(surrendered, {
  brotherId: 'B',
  targetSha: SHA_A,
}), /BROTHER_TURN_VIOLATION/);

const resurrendered = surrenderBrother(challenged, {
  brotherId: 'B',
  reason: 'SECOND_BROTHER_SURRENDER',
  exitSha: SHA_A,
});
assert.equal(resurrendered.activeBrother, 'A');
assert.equal(resurrendered.waitingBrother, 'B');
assert.equal(resurrendered.handoffCount, 2);
assert.equal(resurrendered.state, 'TURN_HANDOFF_REQUIRED');

assert.throws(() => surrenderBrother(resurrendered, {
  brotherId: 'B',
  reason: 'STALE_WRITER_ATTEMPT',
  exitSha: SHA_A,
}), /BROTHER_TURN_VIOLATION/);

assert.throws(() => createBrotherSession({
  repairChainId: identity.repairChainId,
  failureFingerprint: FAILURE,
  targetSha: SHA_A,
  activeBrother: 'C',
}), /BROTHER_ID_INVALID/);

assert.throws(() => assertBrotherAuthority(
  resurrendered,
  { brotherId: 'A', mode: 'WRITE', mutation: true, targetSha: SHA_B },
), /BROTHER_TARGET_SHA_MISMATCH/);

assert.throws(() => transitionRepairCycle(detected, 'RCA'), /CONTROL_PLANE_INVALID_TRANSITION/);
assert.throws(() => transitionRepairCycle(canonical, 'PROMOTION'), /CONTROL_PLANE_INVALID_TRANSITION/);
assert.throws(() => transitionRepairCycle(green, 'CLOSED'), /CONTROL_PLANE_INVALID_TRANSITION/);

const redAgain = transitionRepairCycle(canonical, 'RED_AGAIN', { actor: 'CANONICAL_CI', reason: 'NEW_RED' });
const reopened = transitionRepairCycle(redAgain, 'RCA', { actor: 'INVESTIGATOR', reason: 'SAME_CYCLE_REOPEN' });
assert.equal(reopened.state, 'RCA');

const firstAttempt = recordStrategyAttempt(reopened, { strategy: 'A', progress: false });
const secondAttempt = recordStrategyAttempt(firstAttempt, { strategy: 'B', progress: false });
assert.equal(secondAttempt.stalledCycles, 2);
const thirdAttempt = recordStrategyAttempt(secondAttempt, { strategy: 'C', progress: false });
assert.equal(thirdAttempt.stalledCycles, 3);
assert.equal(thirdAttempt.circuitOpen, true);
assert.equal(thirdAttempt.nextAction, 'ROTATE_STRATEGY_AND_REQUIRE_NEW_EVIDENCE');
const recovered = recordStrategyAttempt(thirdAttempt, { strategy: 'D', progress: true });
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

assert.ok(REPAIR_STATES.includes('BLOCKED_EXTERNAL'));
assert.ok(REPAIR_STATES.includes('STALE'));
assert.ok(REPAIR_STATES.includes('RACE_DETECTED'));
assert.ok(REPAIR_STATES.includes('BUDGET_EXHAUSTED'));
assert.ok(REPAIR_STATES.includes('ROLLBACK_REQUIRED'));
assert.ok(REPAIR_STATES.includes('CERTIFICATION_INVALID'));
assert.ok(REPAIR_STATES.includes('ABORTED'));

const promotedToInvalid = transitionRepairCycle(promotion, 'CERTIFICATION_INVALID', { actor: 'CERTIFICATION', reason: 'CERTIFICATE_STALE' });
assert.equal(promotedToInvalid.state, 'CERTIFICATION_INVALID');
const invalidReverified = transitionRepairCycle(promotedToInvalid, 'CANONICAL_CI', { actor: 'CERTIFICATION', reason: 'RECERTIFY_CURRENT_SHA' });
assert.equal(invalidReverified.state, 'CANONICAL_CI');
const promotedToRace = transitionRepairCycle(promotion, 'RACE_DETECTED', { actor: 'CONTROL_PLANE', reason: 'HEAD_CHANGED' });
assert.equal(promotedToRace.state, 'RACE_DETECTED');
assert.equal(transitionRepairCycle(promotedToRace, 'ABORTED', { actor: 'CONTROL_PLANE', reason: 'RACE_ABORT' }).state, 'ABORTED');
assert.throws(() => transitionRepairCycle({ ...promotion, state: 'CERTIFICATION_INVALID' }, 'CLOSED'), /CONTROL_PLANE_INVALID_TRANSITION/);

const blockedByNewSha = staleRecoveryDecision({
  repairKey: identity.claimKey,
  leaseCreatedAt: '2026-09-18T22:00:00Z',
  now: Date.parse('2026-09-19T00:00:00Z'),
  currentExecutionSha: SHA_B,
  failedSha: SHA_A,
  activeRuns: [],
  outcomes: [],
});
assert.equal(blockedByNewSha.eligible, false);
assert(blockedByNewSha.reasons.includes('EXECUTION_SHA_CHANGED'));

assert.throws(() => deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: 'target-1', branch: 'feature' }), /CONTROL_PLANE_REPAIR_BRANCH_BLOCKED/);
const artifactDigest = 'd'.repeat(64);
const mergeSha = SHA_B;
const artifactEvidence = buildEvidenceProvenance({
  assertionId: 'ASSERT-ARTIFACT', executionUnit: 'job:artifact', sourceSha: SHA_A, runId: 'run-artifact',
  artifactId: 'artifact-1', artifactDigest, result: 'PASS', mergeSha,
});
assert.equal(validateEvidenceProvenance(artifactEvidence, {
  expectedSha: SHA_A, expectedMergeSha: mergeSha, expectedArtifactDigest: artifactDigest,
}).valid, true);
assert.throws(() => validateEvidenceProvenance(artifactEvidence, {
  expectedSha: SHA_A, expectedArtifactDigest: 'e'.repeat(64),
}), /ARTIFACT_DIGEST_MISMATCH/);
assert.throws(() => validateEvidenceProvenance(artifactEvidence, {
  expectedSha: SHA_A, expectedMergeSha: SHA_A,
}), /MERGE_SHA_MISMATCH/);

const externalCycle = { ...promotion, state: 'BLOCKED_EXTERNAL' };
assert.equal(transitionRepairCycle(externalCycle, 'ABORTED', { actor: 'SUPERVISOR', reason: 'EXTERNAL_BLOCKER_CONFIRMED' }).state, 'ABORTED');
const staleCycle = { ...claimed, state: 'STALE' };
assert.equal(transitionRepairCycle(staleCycle, 'CLAIMED', { actor: 'RECOVERY', reason: 'STALE_LEASE_REVALIDATED' }).state, 'CLAIMED');
const budgetCycle = { ...reopened, state: 'BUDGET_EXHAUSTED' };
assert.equal(transitionRepairCycle(budgetCycle, 'RCA', { actor: 'SUPERVISOR', reason: 'BUDGET_EXHAUSTED_REQUALIFY' }).state, 'RCA');
const rollbackCycle = { ...reopened, state: 'ROLLBACK_REQUIRED' };
assert.equal(transitionRepairCycle(rollbackCycle, 'REPAIR_PLANNED', { actor: 'ROLLBACK', reason: 'HISTORICAL_ROLLBACK_REUSE' }).state, 'REPAIR_PLANNED');
assert.throws(() => transitionRepairCycle({ ...promotion, state: 'ABORTED' }, 'RCA'), /CONTROL_PLANE_INVALID_TRANSITION/);
console.log('REPAIR_CONTROL_PLANE=PASS');
