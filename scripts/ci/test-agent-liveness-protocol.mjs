import assert from 'node:assert/strict';
import { AGENT_LIVENESS_PROTOCOL, assertLivenessDefinition, assertState, assertTransition, checkHeartbeat, checkProgress, completionGate, buildRecoveryDirective, idleAdmission, sleepAdmission } from './agent-liveness-protocol.mjs';

assert.equal(assertLivenessDefinition(), true);
assert.deepEqual([...AGENT_LIVENESS_PROTOCOL.forbiddenStates].sort(), ['ABANDONED','IDLE','SILENT','SLEEP'].sort());

for (const state of AGENT_LIVENESS_PROTOCOL.workAssignedStates) assert.doesNotThrow(() => assertState(state, { workAssigned: true }));
for (const forbidden of AGENT_LIVENESS_PROTOCOL.forbiddenStates) assert.throws(() => assertState(forbidden, { workAssigned: true }), /AGENT_LIVENESS_/u);

assert.doesNotThrow(() => assertTransition('ACTIVE', 'WAITING_EXTERNAL', { workAssigned: true }));
assert.doesNotThrow(() => assertTransition('ACTIVE', 'RECOVERING', { workAssigned: true }));
assert.doesNotThrow(() => assertTransition('VERIFYING', 'COMPLETE', { workAssigned: true, authorization: null }));
assert.throws(() => assertTransition('ACTIVE', 'IDLE', { workAssigned: true }), /FORBIDDEN|TRANSITION/u);
assert.throws(() => assertTransition('ACTIVE', 'SLEEP', { workAssigned: true }), /FORBIDDEN|TRANSITION/u);
assert.throws(() => assertTransition('ACTIVE', 'ABORTED', { workAssigned: true }), /ABORT_AUTHORITY/u);

assert.throws(() => idleAdmission({ workAssigned: false }), /GREEN_RECORD_REQUIRED/u);
assert.throws(() => sleepAdmission({ workAssigned: true, greenRecord: { source: 'DAILY_FLIXO_GREEN_GATE' } }), /OPEN_WORK/u);
const green = { source: 'DAILY_FLIXO_GREEN_GATE', conclusion: 'success', zeroRed: true, exactShaVerified: true, targetSha: 'a'.repeat(40), taskId: 'T-1', fingerprint: 'FP-1', recordId: 'GREEN-1', recordedAt: new Date().toISOString() };
assert.equal(idleAdmission({ workAssigned: false, greenRecord: green, targetSha: green.targetSha, taskId: green.taskId, fingerprint: green.fingerprint }).ok, true);
assert.equal(sleepAdmission({ workAssigned: false, greenRecord: green, targetSha: green.targetSha, taskId: green.taskId, fingerprint: green.fingerprint }).state, 'SLEEP');

const fresh = new Date(Date.now() - 2 * 60 * 1000).toISOString();
const stale = new Date(Date.now() - 20 * 60 * 1000).toISOString();
assert.equal(checkHeartbeat({ state: 'ACTIVE', lastHeartbeatAt: fresh }).ok, true);
assert.equal(checkHeartbeat({ state: 'WAITING_EXTERNAL', lastHeartbeatAt: fresh }).ok, true);
assert.equal(checkHeartbeat({ state: 'ACTIVE', lastHeartbeatAt: stale }).action, 'RECOVERY_REQUIRED');

assert.equal(checkProgress({ state: 'ACTIVE', lastProgressAt: fresh }).ok, true);
const p = checkProgress({ state: 'ACTIVE', lastProgressAt: stale, consecutiveNoProgress: 2 });
assert.equal(p.action, 'STRATEGY_ROTATION_REQUIRED');
assert.equal(p.nextState, 'RECOVERING');

assert.throws(() => completionGate({
  state: 'VERIFYING', workAssigned: true, exactShaVerified: false, requiredRedCount: 0, regressionPassed: true, learningRecorded: true
}), /EXACT_SHA/u);
assert.throws(() => completionGate({
  state: 'VERIFYING', workAssigned: true, exactShaVerified: true, requiredRedCount: 1, regressionPassed: true, learningRecorded: true
}), /RED_REMAINS/u);
assert.doesNotThrow(() => completionGate({
  state: 'VERIFYING', workAssigned: true, exactShaVerified: true, requiredRedCount: 0, regressionPassed: true, learningRecorded: true
}));

const recovery = buildRecoveryDirective({ reason: 'HEARTBEAT_STALE', currentState: 'ACTIVE' });
assert.equal(recovery.action, 'RECOVER_AND_CONTINUE');
assert.equal(recovery.to, 'RECOVERING');
assert.equal(recovery.newEvidenceRequired, true);

console.log('AGENT_LIVENESS_CONTRACT=PASS');
