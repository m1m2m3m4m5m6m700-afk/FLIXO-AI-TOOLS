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
} from './repair-control-plane.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const FAILURE = 'f'.repeat(64);

const identity = deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: '123456789', branch: 'execution' });
assert.match(identity.repairChainId, /^RC-[a-f0-9]{20}$/);
assert.match(identity.leaseRef, /^refs\/tags\/flixo-repair-lease-[a-f0-9]{64}$/);
assert.equal(identity.cycleKey, `execution:${SHA_A}:${FAILURE}:123456789`);
const duplicateIdentity = deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: '123456790', branch: 'execution' });
assert.notEqual(duplicateIdentity.claimKey, identity.claimKey);
assert.notEqual(duplicateIdentity.leaseRef, identity.leaseRef);

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
  targetRunId: '1',
  executionSha: SHA_B,
  observedBranch: 'main',
}), /CONTROL_PLANE_REPAIR_BRANCH_BLOCKED/);
assert.throws(() => deriveRepairIdentity({ failureFingerprint: FAILURE, failedSha: SHA_A, targetRunId: '1', branch: 'invalid' }), /CONTROL_PLANE_REPAIR_BRANCH_BLOCKED/);

assert.equal(CIRCUIT_BREAKER.failClosed, true);
const advanced = transitionRepairCycle(claimed, 'EVIDENCE_LOCKED', { actor: 'WATCHER', reason: 'CLI_ADVANCE_TEST' });
assert.equal(advanced.events.at(-1).to, 'EVIDENCE_LOCKED');
console.log('REPAIR_CONTROL_PLANE=PASS');
