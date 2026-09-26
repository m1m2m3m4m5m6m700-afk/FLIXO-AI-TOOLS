import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { AGENT_LIVENESS_PROTOCOL, assertLivenessDefinition, assertState, assertTransition, checkHeartbeat, checkProgress, buildRecoveryDirective, buildTeamWakeDirective, buildResidentWakeBaton, buildTeamPulseDirective, buildDifferentiatedPulseDirective, assessFiveSeatContinuity, assertActiveRepairWindow, checkContinuousSessionWindow, sessionTerminationDirective, assertFiveBotResidencyCommitment, idleAdmission, sleepAdmission, selfDisableAdmission, selfAbortAdmission, runEndAdmission } from './agent-liveness-protocol.mjs';
import { buildFiveBotRotation, cohortMembers, cohortIndexAt, evaluateHandoff } from './five-bot-rotation.mjs';

assert.equal(assertLivenessDefinition(), true);
assert.equal(AGENT_LIVENESS_PROTOCOL.scheduleIntervalMs, 5 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.internalHeartbeatEveryMs, 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.onePulsePerHeartbeat, true);
assert.deepEqual([...AGENT_LIVENESS_PROTOCOL.forbiddenStates].sort(), ['ABANDONED','IDLE','SILENT','SLEEP'].sort());
assert.equal(AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs, 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs, 30 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.wakeIntervalMs, 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.teamWakeIntervalMs, 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.teamWakePolicy, 'ANY_ACTIVE_ACTION_REPAIR_BOT_WAKES_ALL');
assert.equal(AGENT_LIVENESS_PROTOCOL.teamWakeScope, 'ALL_ACTION_REPAIR_TEAM');
assert.equal(AGENT_LIVENESS_PROTOCOL.heartbeatWakePolicy, 'ONE_MINUTE_HEARTBEAT_WAKES_ALL_AGENTS');
assert.equal(AGENT_LIVENESS_PROTOCOL.heartbeatWakeScope, 'ALL_AGENTS');
assert.equal(AGENT_LIVENESS_PROTOCOL.pulseEveryMs, 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotCount, 200);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentRuntimeCount, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentRuntimeIds.length, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.minimumResidentFloor, 1);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentWakePolicy, 'ACTIVE_BOT_WAKES_NEXT_RESIDENT_BEFORE_RELEASE');
assert.equal(AGENT_LIVENESS_PROTOCOL.residentWakeBatonTtlMs, 90 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotIds.length, 200);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotIds[0], 'CELL-001');
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotIds[199], 'CELL-200');
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentDomains.length, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles.length, 200);
assert.equal(new Set(AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles.map(x=>x.botId)).size, 200);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentDomains.every(domain=>AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles.filter(x=>x.domainId===domain.id).length===20), true);
assert.equal(AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles.every(x=>x.mutationAuthority===false && x.certificationAuthority===false && x.skills.length>0), true);
assert.equal(AGENT_LIVENESS_PROTOCOL.pulseProfiles.length, 10);
assert.equal(new Set(AGENT_LIVENESS_PROTOCOL.pulseProfiles.map(x=>x.pulseType)).size, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.idleSweepMode, 'FULL_REPOSITORY_READ_ONLY_SCAN');
assert.equal(AGENT_LIVENESS_PROTOCOL.idleSweepPlanLedger, 'المهام.md');
assert.equal(AGENT_LIVENESS_PROTOCOL.actionRepairTeamSize, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.length, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.requiredBotCount, 5);
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.postTaskState, 'READY_RESIDENT');
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.journeyLogicalBotCount, 200);
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.journeyCohortCount, 40);
assert.equal(AGENT_LIVENESS_PROTOCOL.activeCohortCount,40);
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.journeyCohortSize, 5);
assert.equal(AGENT_LIVENESS_PROTOCOL.fiveBotResidencyCommitment.retainResidentUntilJourneyComplete, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.seatContinuityContract.minimumConnectedSeats,5);
assert.equal(AGENT_LIVENESS_PROTOCOL.seatContinuityContract.heartbeatAckRequired,true);
assert.equal(AGENT_LIVENESS_PROTOCOL.seatContinuityContract.generatedWakeIsNotAttendanceProof,true);
assert.equal(AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs, 60 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs, 3 * 60 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs, 5 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.taskReminderEveryMs, 10 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.totalTaskDurationUnlimitedWhileOpen, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.masterChannelRequired, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowMs, 60 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowEnforced, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.noSleepDuringActiveWindow, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.noIdleDuringActiveWindow, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.cellLabRequired, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.zeroErrorTarget, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.schemaVersion, 5);
assert.equal(AGENT_LIVENESS_PROTOCOL.protocolVersion, '5.0.0');
assert.equal(AGENT_LIVENESS_PROTOCOL.contractRank, 'SUPREME_AUTOMATION_RESIDENCY');
assert.equal(AGENT_LIVENESS_PROTOCOL.manualWakeRequired, false);
assert.equal(AGENT_LIVENESS_PROTOCOL.selfDisableAllowed, false);
assert.equal(AGENT_LIVENESS_PROTOCOL.selfAbortAllowed, false);

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
assert.equal(checkHeartbeat({state:'ACTIVE',lastHeartbeatAt:new Date(Date.now()-40*1000).toISOString()}).ok,true);
assert.equal(checkHeartbeat({state:'ACTIVE',lastHeartbeatAt:new Date(Date.now()-2*60*1000).toISOString()}).action,'RECOVERY_REQUIRED');
assert.equal(checkProgress({state:'ACTIVE',lastProgressAt:new Date(Date.now()-2*60*1000).toISOString()}).ok,true);
assert.equal(checkProgress({state:'ACTIVE',lastProgressAt:new Date(Date.now()-20*60*1000).toISOString(),consecutiveNoProgress:2}).action,'STRATEGY_ROTATION_REQUIRED');
assert.throws(() => sleepAdmission(), /SLEEP_FORBIDDEN_PERMANENT_RESIDENCY/u);
assert.throws(() => idleAdmission(), /IDLE_FORBIDDEN_PERMANENT_RESIDENCY/u);
assert.throws(() => selfDisableAdmission(), /SELF_DISABLE_FORBIDDEN_PERMANENT_RESIDENCY/u);
assert.throws(() => selfAbortAdmission(), /SELF_ABORT_FORBIDDEN_PERMANENT_RESIDENCY/u);
assert.throws(() => runEndAdmission(), /RUN_END_DOES_NOT_END_TASK/u);
const seatContinuity=assessFiveSeatContinuity({
  activeRuntimeIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],
  stagedRuntimeIds:['FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10'],
  heartbeatAcks:[
    {runtimeId:'FLIXO1',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO2',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO3',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO4',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO5',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
  ],
  targetSha:'a'.repeat(40),
});
assert.equal(seatContinuity.ok,true);
assert.equal(seatContinuity.activeSeatCount,5);
assert.equal(seatContinuity.replacementRequired,false);
const lazySeatContinuity=assessFiveSeatContinuity({
  activeRuntimeIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],
  stagedRuntimeIds:['FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10'],
  heartbeatAcks:[
    {runtimeId:'FLIXO1',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO2',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO3',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO4',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:true,at:new Date().toISOString()},
    {runtimeId:'FLIXO5',targetSha:'a'.repeat(40),state:'ACTIVE',heartbeatAck:false,at:new Date().toISOString()},
  ],
  targetSha:'a'.repeat(40),
});
assert.equal(lazySeatContinuity.ok,false);
assert.equal(lazySeatContinuity.lazyBotDetected,true);
assert.equal(lazySeatContinuity.replacementRequired,true);
assert.equal(lazySeatContinuity.replacementCount,1);
assert.equal(lazySeatContinuity.action,'FAIL_CLOSED_AND_REPLACE');
const residency=assertFiveBotResidencyCommitment({botIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],states:['ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE'],taskClosed:false,journeyComplete:false});
assert.equal(residency.ok,true);
assert.equal(residency.requiredBotCount,5);
assert.equal(residency.postTaskState,'READY_RESIDENT');
assert.equal(residency.retainResidentUntilJourneyComplete,true);
const closedResidency=assertFiveBotResidencyCommitment({botIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],states:['READY_RESIDENT','READY_RESIDENT','READY_RESIDENT','READY_RESIDENT','READY_RESIDENT'],taskClosed:true,journeyComplete:false});
assert.equal(closedResidency.ok,true);
assert.equal(closedResidency.journeyComplete,false);
assert.throws(()=>assertFiveBotResidencyCommitment({botIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],states:['READY_RESIDENT','READY_RESIDENT','SLEEP','READY_RESIDENT','READY_RESIDENT'],taskClosed:true}),/FORBIDDEN_STATE/u);
assert.throws(()=>assertFiveBotResidencyCommitment({botIds:['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5'],states:['ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE'],taskClosed:true}),/MUST_REMAIN_READY_RESIDENT/u);
const baton = buildResidentWakeBaton({
  actor:'FLIXO1',
  nextActor:'FLIXO6',
  targetSha:'a'.repeat(40),
  taskId:'TASK-RESIDENT-HANDOFF',
  now:'2026-09-25T00:00:00Z',
});
assert.equal(baton.protocol,'FLIXO-RESIDENT-WAKE-BATON-v1');
assert.equal(baton.action,'WAKE_NEXT_RESIDENT_BOT');
assert.equal(baton.actor,'FLIXO1');
assert.equal(baton.nextActor,'FLIXO6');
assert.equal(baton.targetSha,'a'.repeat(40));
assert.equal(baton.minimumResidentFloor,1);
assert.equal(baton.nextMustAckBeforeRelease,true);
assert.equal(baton.mutationAuthority,false);
assert.throws(()=>buildResidentWakeBaton({actor:'FLIXO1',nextActor:'FLIXO1',targetSha:'a'.repeat(40)}),/SELF_FORBIDDEN/u);
assert.throws(()=>buildResidentWakeBaton({actor:'BAD',targetSha:'a'.repeat(40)}),/ACTOR_INVALID/u);

const teamWake=buildTeamWakeDirective({
  actor:'FLIXO1',
  targetSha:'a'.repeat(40),
  taskId:'TASK-HEARTBEAT',
  failureFingerprint:'fp-team-wake',
});
assert.equal(teamWake.action,'WAKE_ALL_ACTION_REPAIR_TEAM');
assert.equal(teamWake.recipientCount,10);
assert.equal(teamWake.mutationAuthority,false);
assert.equal(teamWake.pushAuthority,'CHAIR_1_ONLY');
assert.deepEqual(teamWake.recipients,AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds);
assert.throws(() => buildTeamWakeDirective({actor:'UNKNOWN-BOT',targetSha:'a'.repeat(40)}), /TEAM_WAKE_ACTOR_NOT_AUTHORIZED/u);

const teamPulse=buildTeamPulseDirective({targetSha:'a'.repeat(40),taskId:'TASK-PULSE',activeOperation:false,activeWorker:'FLIXO1'});
const livenessCliOutput=execFileSync(process.execPath,[path.resolve(process.cwd(),'scripts/ci/agent-liveness-protocol.mjs'),'resident-baton','--actor=FLIXO1','--next=FLIXO6','--sha='+'a'.repeat(40),'--task=CLI-RESIDENT'],{encoding:'utf8'});
assert.match(livenessCliOutput,/WAKE_NEXT_RESIDENT_BOT/u);
assert.equal(teamPulse.action,'WAKE_ALL_AGENTS');
assert.equal(teamPulse.wakeScope,'ALL_AGENTS');
assert.deepEqual(teamPulse.recipients,['ALL_AGENTS']);
assert.equal(teamPulse.recipientCount,10);
assert.equal(teamPulse.teamMemberCount,10);
assert.equal(teamPulse.logicalBotCount,200);
assert.equal(teamPulse.residentRuntimeCount,10);
assert.equal(teamPulse.logicalBotIds.length,200);
assert.equal(teamPulse.logicalBotIds[0],'CELL-001');
assert.equal(teamPulse.logicalBotIds[199],'CELL-200');
assert.equal(teamPulse.developmentProfiles.length,200);
assert.equal(new Set(teamPulse.developmentProfiles.map(x=>x.domainId)).size,10);
assert.equal(teamPulse.developmentProfiles.every(x=>x.mutationAuthority===false),true);
assert.equal(teamPulse.mode,'READY_RESIDENT');
assert.equal(teamPulse.residentState,'READY_RESIDENT');
assert.equal(teamPulse.sleep,false);
assert.equal(teamPulse.idle,false);
assert.equal(teamPulse.readOnlyWhenResident,true);
assert.equal('readOnlyWhenIdle' in teamPulse,false);
assert.equal(teamPulse.onePulsePerHeartbeat,true);
assert.equal(teamPulse.pushAuthority,'CHAIR_1_ONLY');
assert.equal(buildDifferentiatedPulseDirective({actor:'FLIXO2',targetSha:'a'.repeat(40)}).pulseType,'CANONICAL_TEAM_HEARTBEAT');
assert.throws(()=>buildTeamPulseDirective({targetSha:'bad'}),/PULSE_EXACT_SHA_REQUIRED/u);
assert.throws(()=>buildTeamPulseDirective({targetSha:'a'.repeat(40),activeWorker:'UNKNOWN-BOT'}),/ACTIVE_WORKER_NOT_AUTHORIZED/u);

const recovery=buildRecoveryDirective({reason:'HEARTBEAT_STALE',currentState:'ACTIVE'});
assert.equal(recovery.action,'RECOVER_AND_CONTINUE');
assert.equal(recovery.to,'RECOVERING');
const sessionEnd=sessionTerminationDirective({canonicalGreen:false,reason:'HEARTBEAT_GAP'});
assert.equal(sessionEnd.action,'RECOVER_AND_REDISPATCH');
assert.equal(sessionEnd.taskRemainsOpen,true);
assert.equal(sessionEnd.residentState,'ACTIVE_OR_RECOVERING');
assert.throws(() => assertActiveRepairWindow({startedAt:new Date(Date.now()-44*60*1000).toISOString()}), /ACTIVE_WINDOW_NOT_COMPLETE/u);
assert.throws(() => assertActiveRepairWindow({startedAt:new Date(Date.now()-61*60*1000).toISOString(), continuousStartedAt:new Date(Date.now()-60*60*1000+1000).toISOString()}), /ACTIVE_WINDOW_NOT_COMPLETE/u);
assert.doesNotThrow(() => assertActiveRepairWindow({startedAt:new Date(Date.now()-70*60*1000).toISOString(), continuousStartedAt:new Date(Date.now()-60*60*1000-1000).toISOString()}));
assert.throws(() => assertActiveRepairWindow({startedAt:new Date(Date.now()-60*60*1000).toISOString(), continuousStartedAt:new Date(Date.now()-44*60*1000).toISOString()}), /ACTIVE_WINDOW_NOT_COMPLETE/u);
const greenEarly=sessionTerminationDirective({canonicalGreen:true,activeRepairWindowReached:false});
assert.equal(greenEarly.action,'RECOVER_AND_CONTINUE');
assert.equal(greenEarly.taskRemainsOpen,true);
const greenAfter=sessionTerminationDirective({canonicalGreen:true,activeRepairWindowReached:true});
assert.equal(greenAfter.action,'CLOSE_ALLOWED');
assert.equal(checkContinuousSessionWindow({continuousStartedAt:new Date(Date.now()-179*60*1000).toISOString()}).action,'CONTINUE');
assert.equal(checkContinuousSessionWindow({continuousStartedAt:new Date(Date.now()-181*60*1000).toISOString()}).action,'RESIDENCY_RENEWAL_REQUIRED');
assert.equal(greenAfter.taskRemainsOpen,false);
const green=sessionTerminationDirective({canonicalGreen:true,activeRepairWindowReached:true});
assert.equal(green.action,'CLOSE_ALLOWED');
assert.equal(green.residentState,'READY_RESIDENT');
assert.equal(green.fiveBotResidency.postTaskState,'READY_RESIDENT');
assert.equal(green.fiveBotResidency.retainResidentUntilJourneyComplete,true);
assert.equal(green.fiveBotResidency.journeyLogicalBotCount,200);
assert.equal(green.fiveBotResidency.journeyCohortCount,40);
assert.equal(green.fiveBotResidency.sleep,false);
assert.equal(green.fiveBotResidency.idle,false);

const sha='a'.repeat(40);
const rotationPlan=buildFiveBotRotation({targetSha:sha,now:'2026-09-23T22:00:00Z'});
assert.equal(rotationPlan.logicalBotCount,200);
assert.equal(rotationPlan.activeBotCount,5);
assert.equal(rotationPlan.activeBotIds.length,5);
assert.equal(rotationPlan.nextBotIds.length,5);
assert.equal(rotationPlan.activeRuntimeCount,5);
assert.equal(rotationPlan.stagedRuntimeCount,5);
assert.equal(new Set(rotationPlan.activeBotIds).size,5);
assert.deepEqual(rotationPlan.activeBotIds,cohortMembers(rotationPlan.cohortIndex));
assert.equal(rotationPlan.fiveBotResidency.requiredBotCount,5);
assert.equal(rotationPlan.fiveBotResidency.postTaskCloseState,'READY_RESIDENT');
assert.equal(rotationPlan.fiveBotResidency.retainResidentUntilJourneyComplete,true);
assert.equal(rotationPlan.fiveBotResidency.journeyLogicalBotCount,200);
assert.equal(rotationPlan.fiveBotResidency.journeyCohortCount,40);
assert.equal(rotationPlan.fiveBotResidency.journeyCohortSize,5);
assert.equal(rotationPlan.fiveBotResidency.sleep,false);
assert.equal(rotationPlan.fiveBotResidency.idle,false);
assert.equal(cohortIndexAt(Date.parse('2026-09-23T22:00:00Z')),rotationPlan.cohortIndex);
assert.equal(evaluateHandoff({fromCohortIndex:0,toCohortIndex:1,readyBotIds:[],elapsedMs:60*60*1000,targetSha:sha}).status,'WAIT_NEXT_COHORT_READY');
assert.equal(evaluateHandoff({fromCohortIndex:0,toCohortIndex:1,readyBotIds:cohortMembers(1),elapsedMs:60*60*1000,targetSha:sha}).status,'HANDOFF_COMMITTED');
const pulseOutput=execFileSync(process.execPath,[path.resolve(process.cwd(),'scripts/ci/flixo-ten-pulse.mjs'),`--sha=${sha}`,'--run-id=TEST-100-RESIDENCY','--minute=2026-09-23T22:00:00Z','--active-operation=true','--output=/tmp/test-flixo-team-pulse.json'],{encoding:'utf8'});
assert.ok(pulseOutput.includes('activeBotCount'));
const pulseReport=JSON.parse(fs.readFileSync('/tmp/test-flixo-team-pulse.json','utf8'));
assert.equal(pulseReport.logicalBotCount,200);
assert.equal(pulseReport.activeBotCount,5);
assert.equal(pulseReport.activeBotIds.length,5);
assert.equal(pulseReport.nextBotIds.length,5);
assert.equal(pulseReport.fiveBotResidency.requiredBotCount,5);
assert.equal(pulseReport.fiveBotResidency.postTaskCloseState,'READY_RESIDENT');
assert.equal(pulseReport.fiveBotResidency.journeyLogicalBotCount,200);
assert.equal(pulseReport.fiveBotResidency.journeyCohortCount,40);
assert.equal(pulseReport.logicalBotIds.length,200);
assert.equal(pulseReport.pulses[0].logicalBotIds.length,200);

const sessionSource=fs.readFileSync(path.resolve(process.cwd(),'scripts/ci/agent-session.mjs'),'utf8');
assert.match(sessionSource,/activeRepairWindowMs/u);
assert.match(sessionSource,/AGENT_SESSION_BLOCKED_LOGOUT_FORBIDDEN_OPEN_WORK_REMAINS/u);
assert.match(sessionSource,/AGENT_SESSION_HEARTBEAT_REQUIRED_BEFORE_CLOSE/u);

console.log('AGENT_LIVENESS_CONTRACT=PASS');

assert.match(sessionSource,/master-update/u);
assert.match(sessionSource,/MASTER_CELL_LAB/u);
assert.match(sessionSource,/TASK_REMINDER/u);
const heartbeatWorkflow=fs.readFileSync(path.resolve(process.cwd(),'.github/workflows/agent-repair-heartbeat.yml'),'utf8');
assert.match(heartbeatWorkflow,/workflow_dispatch:/u);
assert.match(heartbeatWorkflow,/cancel-in-progress:\s*false/u);
assert.doesNotMatch(heartbeatWorkflow,/schedule:\s*\n\s*- cron:/u);
assert.match(heartbeatWorkflow,/ACTIVE_BOT_COUNT=5/u);
assert.match(heartbeatWorkflow,/ACTIVE_BOT_COMMITMENT_MINUTES=60/u);
assert.match(heartbeatWorkflow,/ACTIVE_BOT_COHORT_COUNT=40/u);
assert.match(heartbeatWorkflow,/LOGICAL_BOT_CYCLE=200_TO_1/u);
assert.match(heartbeatWorkflow,/NEXT_COHORT_READY_REQUIRED=true/u);
assert.match(heartbeatWorkflow,/ACTIVE_RUNTIME_CAPACITY=5/u);
assert.match(heartbeatWorkflow,/five-bot-rotation\.mjs/u);
assert.match(heartbeatWorkflow,/action-repair-five-workers\.mjs --role=wake/u);
assert.match(heartbeatWorkflow,/flixo-ten-pulse\.mjs/u);
assert.match(heartbeatWorkflow,/ACTIVE_COHORT_COMMITMENT_SECONDS=3600/u);
assert.match(heartbeatWorkflow,/ACTIVE_COHORT_HANDOFF=NEXT_5_READY_BEFORE_RELEASE/u);
assert.doesNotMatch(heartbeatWorkflow,/gh workflow run agent-repair-heartbeat\.yml/u);
const watchdogWorkflow=fs.readFileSync(path.resolve(process.cwd(),'.github/workflows/execution-bot-watchdog.yml'),'utf8');
assert.match(watchdogWorkflow,/workflow_run:/u);
assert.match(watchdogWorkflow,/schedule:/u);
assert.match(watchdogWorkflow,/cron:\s*'\*\/5 \* \* \* \*'/u);
assert.match(watchdogWorkflow,/Ensure resident Heartbeat window exists/u);
assert.match(watchdogWorkflow,/ACTIVE_HEARTBEATS=.*headSha/u);
assert.match(watchdogWorkflow,/RESIDENT_HEARTBEAT_DISPATCH=NOOP_ACTIVE/u);
assert.match(watchdogWorkflow,/actions\/workflows\/agent-repair-heartbeat\.yml\/dispatches/u);
assert.doesNotMatch(heartbeatWorkflow,/pull_request:/u);
console.log('FIVE_BOT_ROTATION_CONTRACT=PASS');
