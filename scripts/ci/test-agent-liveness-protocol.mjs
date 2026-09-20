import assert from 'node:assert/strict';
import { AGENT_LIVENESS_PROTOCOL, assertLivenessDefinition, assertState, assertTransition, checkHeartbeat, checkProgress, buildRecoveryDirective, sessionTerminationDirective, idleAdmission, sleepAdmission } from './agent-liveness-protocol.mjs';

assert.equal(assertLivenessDefinition(), true);
assert.deepEqual([...AGENT_LIVENESS_PROTOCOL.forbiddenStates].sort(), ['ABANDONED','IDLE','SILENT','SLEEP'].sort());
assert.equal(AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs, 5 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.protocolVersion, '3.0.0');

for (const state of AGENT_LIVENESS_PROTOCOL.workAssignedStates) assert.doesNotThrow(() => assertState(state, { workAssigned: true }));
for (const forbidden of AGENT_LIVENESS_PROTOCOL.forbiddenStates) assert.throws(() => assertState(forbidden, { workAssigned: true }), /AGENT_LIVENESS_/u);

assert.doesNotThrow(() => assertTransition('ACTIVE','WAITING_EXTERNAL',{workAssigned:true}));
assert.doesNotThrow(() => assertTransition('ACTIVE','RECOVERING',{workAssigned:true}));
assert.throws(() => assertTransition('ACTIVE','IDLE',{workAssigned:true}), /PERMANENT_RESIDENCY|FORBIDDEN/u);
assert.throws(() => assertTransition('ACTIVE','SLEEP',{workAssigned:true}), /PERMANENT_RESIDENCY|FORBIDDEN/u);
assert.throws(() => assertTransition('ACTIVE','ABORTED',{workAssigned:true}), /ABORT_DISABLED/u);

assert.doesNotThrow(() => assertTransition('VERIFYING','COMPLETE',{
  workAssigned:true, exactShaVerified:true, requiredRedCount:0, regressionPassed:true, learningRecorded:true,
}));
assert.equal(checkHeartbeat({state:'ACTIVE',lastHeartbeatAt:new Date(Date.now()-2*60*1000).toISOString()}).ok,true);
assert.equal(checkHeartbeat({state:'ACTIVE',lastHeartbeatAt:new Date(Date.now()-20*60*1000).toISOString()}).action,'RECOVERY_REQUIRED');
assert.equal(checkProgress({state:'ACTIVE',lastProgressAt:new Date(Date.now()-2*60*1000).toISOString()}).ok,true);
assert.equal(checkProgress({state:'ACTIVE',lastProgressAt:new Date(Date.now()-20*60*1000).toISOString(),consecutiveNoProgress:2}).action,'STRATEGY_ROTATION_REQUIRED');
assert.throws(() => sleepAdmission(), /SLEEP_FORBIDDEN_PERMANENT_RESIDENCY/u);
assert.throws(() => idleAdmission(), /IDLE_FORBIDDEN_PERMANENT_RESIDENCY/u);
const recovery=buildRecoveryDirective({reason:'HEARTBEAT_STALE',currentState:'ACTIVE'});
assert.equal(recovery.action,'RECOVER_AND_CONTINUE');
assert.equal(recovery.to,'RECOVERING');
const sessionEnd=sessionTerminationDirective({canonicalGreen:false,reason:'HEARTBEAT_GAP'});
assert.equal(sessionEnd.action,'RECOVER_AND_REDISPATCH');
assert.equal(sessionEnd.taskRemainsOpen,true);
assert.equal(sessionEnd.residentState,'ACTIVE_OR_RECOVERING');
const green=sessionTerminationDirective({canonicalGreen:true});
assert.equal(green.action,'CLOSE_ALLOWED');
assert.equal(green.residentState,'READY_RESIDENT');

console.log('AGENT_LIVENESS_CONTRACT=PASS');
