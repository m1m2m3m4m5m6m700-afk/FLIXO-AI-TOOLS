#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  INVOCATION_STATES,
  buildInvocationIdentity,
  buildInvocationFromMessage,
  assertInvocationCurrent,
  transitionInvocation,
  supersedeInvocation,
  canTransition,
  isRecoveryAdmissible,
  assertRecoveryAdmissible,
  buildRecoveryDecision,
} from './invocation-contract.mjs';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const baseMessage = {
  messageId: 'INVOCATION-TEST-001',
  idempotencyKey: 'INVOCATION-TEST-001:1',
  actor: 'assistantController',
  recipient: 'ALL_AGENTS',
  intent: 'COUNCIL_INVOCATION_CONTRACT_TEST',
  taskId: 'INVOCATION-CONTRACT-001',
  scope: ['scripts/ci/invocation-contract.mjs'],
  entrySha: SHA_A,
  risk: 'HIGH',
  dependencies: ['canonical-contract'],
  expectedEvidence: ['transition-proof'],
  stopConditions: ['stale-sha'],
  proofObligations: ['exact-sha'],
  createdAt: '2026-09-21T00:00:00.000Z',
  payload: {
    failureFingerprint: 'fp:invocation-contract',
    attempt: 2,
    leaseEpoch: 3,
  },
};

const identityOne = buildInvocationIdentity({
  messageId: baseMessage.messageId,
  taskId: baseMessage.taskId,
  targetSha: SHA_A,
  failureFingerprint: baseMessage.payload.failureFingerprint,
  attempt: 2,
  leaseEpoch: 3,
});
const identityTwo = buildInvocationIdentity({
  messageId: baseMessage.messageId,
  taskId: baseMessage.taskId,
  targetSha: SHA_A,
  failureFingerprint: baseMessage.payload.failureFingerprint,
  attempt: 2,
  leaseEpoch: 3,
});
assert.deepEqual(identityOne, identityTwo);
assert.notEqual(identityOne.invocationId, buildInvocationIdentity({
  ...baseMessage,
  targetSha: SHA_A,
  failureFingerprint: baseMessage.payload.failureFingerprint,
  attempt: 3,
  leaseEpoch: 3,
}).invocationId);
assert.notEqual(identityOne.invocationId, buildInvocationIdentity({
  ...baseMessage,
  targetSha: SHA_A,
  failureFingerprint: baseMessage.payload.failureFingerprint,
  attempt: 2,
  leaseEpoch: 4,
}).invocationId);
assert.equal(identityOne.targetSha, SHA_A);
assert.equal(identityOne.attempt, 2);
assert.equal(identityOne.leaseEpoch, 3);

const invocation = buildInvocationFromMessage(baseMessage, { currentSha: SHA_A });
assert.equal(invocation.state, 'DISPATCHED');
assert.equal(invocation.targetSha, SHA_A);
assert.equal(invocation.failureFingerprint, 'fp:invocation-contract');
assert.equal(invocation.attempt, 2);
assert.equal(invocation.leaseEpoch, 3);
assert.ok(/^INV-[a-f0-9]{32}$/u.test(invocation.invocationId));
assertInvocationCurrent(invocation, SHA_A);
assert.throws(() => buildInvocationFromMessage(baseMessage, { currentSha: SHA_B }), /STALE_TARGET_SHA/);
assert.throws(() => assertInvocationCurrent(invocation, SHA_B), /STALE_TARGET_SHA/);

let current = transitionInvocation(invocation, 'RECEIVED', { currentSha: SHA_A, at: '2026-09-21T00:00:01.000Z' });
current = transitionInvocation(current, 'ACCEPTED', { currentSha: SHA_A, at: '2026-09-21T00:00:02.000Z' });
current = transitionInvocation(current, 'STARTED', { currentSha: SHA_A, at: '2026-09-21T00:00:03.000Z' });
current = transitionInvocation(current, 'HEARTBEAT', { currentSha: SHA_A, at: '2026-09-21T00:00:04.000Z' });
current = transitionInvocation(current, 'COMPLETED', { currentSha: SHA_A, at: '2026-09-21T00:00:05.000Z', evidenceRef: 'evidence:complete' });
current = transitionInvocation(current, 'VERIFIED', { currentSha: SHA_A, at: '2026-09-21T00:00:06.000Z', evidenceRef: 'evidence:verify' });
assert.equal(current.state, 'VERIFIED');
assert.deepEqual(current.evidenceRefs, ['evidence:complete', 'evidence:verify']);
assert.equal(canTransition('DISPATCHED', 'RECEIVED'), true);
assert.equal(canTransition('VERIFIED', 'STARTED'), false);
assert.throws(() => transitionInvocation(invocation, 'VERIFIED', { currentSha: SHA_A }), /TRANSITION_FORBIDDEN/);

const staleCandidate = buildInvocationFromMessage(baseMessage, { currentSha: SHA_A });
const superseded = supersedeInvocation(staleCandidate, { newerSha: SHA_B, currentSha: SHA_B, at: '2026-09-21T00:01:00.000Z', evidenceRef: 'evidence:supersession' });
assert.equal(superseded.state, 'SUPERSEDED');
assert.equal(superseded.supersededBySha, SHA_B);
assert.throws(() => supersedeInvocation(staleCandidate, { newerSha: SHA_A, currentSha: SHA_A }), /REQUIRES_NEWER_SHA/);
assert.throws(() => supersedeInvocation(staleCandidate, { newerSha: SHA_B, currentSha: SHA_A }), /SUPERSESSION_SHA_NOT_CURRENT/);

const admissible = {
  leaseExpired: true,
  heartbeatValid: false,
  newerInvocationExists: false,
  exactShaCurrent: true,
  competingOwner: false,
};
assert.equal(isRecoveryAdmissible(admissible), true);
assert.equal(assertRecoveryAdmissible(admissible), true);
assert.deepEqual(buildRecoveryDecision(admissible), {
  admissible: true,
  rule: 'LEASE_EXPIRED + NO_VALID_HEARTBEAT + NO_NEWER_INVOCATION + EXACT_SHA_CURRENT + NO_COMPETING_OWNER',
});
for (const key of Object.keys(admissible)) {
  assert.throws(() => assertRecoveryAdmissible({ ...admissible, [key]: key === 'leaseExpired' ? false : admissible[key] }), /RECOVERY_NOT_ADMISSIBLE/);
}
for (const state of INVOCATION_STATES) {
  if (state === 'VERIFIED') assert.equal(canTransition(state, 'STARTED'), false);
}
console.log('INVOCATION_CONTRACT_TEST=PASS');
console.log('INVOCATION_IDENTITY=PASS');
console.log('INVOCATION_LIFECYCLE=PASS');
console.log('INVOCATION_SUPERSESSION=PASS');
console.log('INVOCATION_RECOVERY_GATE=PASS');
