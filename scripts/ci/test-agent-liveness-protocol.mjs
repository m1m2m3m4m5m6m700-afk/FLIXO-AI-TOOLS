import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { AGENT_LIVENESS_PROTOCOL, assertLivenessDefinition, assertState, assertTransition, checkHeartbeat, checkProgress, buildRecoveryDirective, buildTeamWakeDirective, buildTeamPulseDirective, buildDifferentiatedPulseDirective, assertActiveRepairWindow, checkContinuousSessionWindow, sessionTerminationDirective, idleAdmission, sleepAdmission, selfDisableAdmission, selfAbortAdmission, runEndAdmission } from './agent-liveness-protocol.mjs';

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
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotCount, 100);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotIds.length, 100);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotIds[0], 'CELL-001');
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotIds[99], 'CELL-100');
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentDomains.length, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.length, 100);
assert.equal(new Set(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.map(x=>x.botId)).size, 100);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentDomains.every(domain=>AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.filter(x=>x.domainId===domain.id).length===10), true);
assert.equal(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.every(x=>x.mutationAuthority===false && x.certificationAuthority===false && x.skills.length>0), true);
assert.equal(AGENT_LIVENESS_PROTOCOL.pulseProfiles.length, 10);
assert.equal(new Set(AGENT_LIVENESS_PROTOCOL.pulseProfiles.map(x=>x.pulseType)).size, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.idleSweepMode, 'FULL_REPOSITORY_READ_ONLY_SCAN');
assert.equal(AGENT_LIVENESS_PROTOCOL.idleSweepPlanLedger, 'المهام.md');
assert.equal(AGENT_LIVENESS_PROTOCOL.actionRepairTeamSize, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.length, 10);
assert.equal(AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs, 45 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs, 3 * 60 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs, 5 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.taskReminderEveryMs, 10 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.totalTaskDurationUnlimitedWhileOpen, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.masterChannelRequired, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowMs, 45 * 60 * 1000);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowEnforced, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.noSleepDuringActiveWindow, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.noIdleDuringActiveWindow, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.cellLabRequired, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.sessionPolicy.zeroErrorTarget, true);
assert.equal(AGENT_LIVENESS_PROTOCOL.protocolVersion, '4.0.0');
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
const teamWake=buildTeamWakeDirective({
  actor:'ACTION-TWIN-1',
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
assert.equal(teamPulse.action,'WAKE_ALL_AGENTS');
assert.equal(teamPulse.wakeScope,'ALL_AGENTS');
assert.deepEqual(teamPulse.recipients,['ALL_AGENTS']);
assert.equal(teamPulse.recipientCount,1);
assert.equal(teamPulse.teamMemberCount,10);
assert.equal(teamPulse.residentBotCount,100);
assert.equal(teamPulse.residentBotIds.length,100);
assert.equal(teamPulse.residentBotIds[0],'CELL-001');
assert.equal(teamPulse.residentBotIds[99],'CELL-100');
assert.equal(teamPulse.developmentProfiles.length,100);
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
assert.doesNotThrow(() => assertActiveRepairWindow({startedAt:new Date(Date.now()-60*60*1000).toISOString(), continuousStartedAt:new Date(Date.now()-45*60*1000-1000).toISOString()}));
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

const pulseOutput=execFileSync(process.execPath,[path.resolve(process.cwd(),'scripts/ci/flixo-ten-pulse.mjs'),`--sha=${sha}`,'--run-id=TEST-100-RESIDENCY','--minute=2026-09-23T22:00','--active-operation=true'],{encoding:'utf8'});
const pulseReport=JSON.parse(pulseOutput);
assert.equal(pulseReport.residentBotCount,100);
assert.equal(pulseReport.residentBotIds.length,100);
assert.equal(pulseReport.pulses[0].residentBotCount,100);
assert.equal(pulseReport.pulses[0].residentBotIds.length,100);

const sessionSource=fs.readFileSync(path.resolve(process.cwd(),'scripts/ci/agent-session.mjs'),'utf8');
assert.match(sessionSource,/activeRepairWindowMs/u);
assert.match(sessionSource,/AGENT_SESSION_BLOCKED_LOGOUT_FORBIDDEN_OPEN_WORK_REMAINS/u);
assert.match(sessionSource,/AGENT_SESSION_HEARTBEAT_REQUIRED_BEFORE_CLOSE/u);
assert.match(sessionSource,/agent-session\.mjs heartbeat/u);

console.log('AGENT_LIVENESS_CONTRACT=PASS');

assert.match(sessionSource,/master-update/u);
assert.match(sessionSource,/MASTER_CELL_LAB/u);
assert.match(sessionSource,/TASK_REMINDER/u);
const heartbeatWorkflow=fs.readFileSync(path.resolve(process.cwd(),'.github/workflows/agent-repair-heartbeat.yml'),'utf8');
assert.match(heartbeatWorkflow,/workflow_dispatch:/u);
assert.match(heartbeatWorkflow,/FLIXO Agent Repair Heartbeat/u);
assert.match(heartbeatWorkflow,/cancel-in-progress:\s*true/u);
assert.match(heartbeatWorkflow,/RESIDENT_READY_STATE=READY_RESIDENT/u);
assert.match(heartbeatWorkflow,/RESIDENT_SLEEP=false/u);
assert.match(heartbeatWorkflow,/RESIDENT_IDLE=false/u);
assert.match(heartbeatWorkflow,/CONTINUOUS_REARM=WORKFLOW_DISPATCH_ON_EXECUTION/u);
assert.match(heartbeatWorkflow,/group: \$\{\{ github\.ref_name == 'execution'/u);
assert.match(heartbeatWorkflow,/refs\/heads\/execution/u);
assert.match(heartbeatWorkflow,/gh workflow run agent-repair-heartbeat\.yml.*--ref execution/u);
assert.match(heartbeatWorkflow,/schedule:/u);
assert.match(heartbeatWorkflow,/cron: '\*\/5 \* \* \* \*'/u);
assert.match(heartbeatWorkflow,/TASK_BACKLOG_OPEN=/u);
assert.match(heartbeatWorkflow,/MISSION_OPEN=/u);
assert.match(heartbeatWorkflow,/action-repair-five-workers\.mjs --role=fanout/u);
assert.match(sessionSource,/SESSION_SHA_CHANGED/u);
const watchdogWorkflow=fs.readFileSync(path.resolve(process.cwd(),'.github/workflows/execution-bot-watchdog.yml'),'utf8');
assert.match(watchdogWorkflow,/on:\s*\n\s*workflow_dispatch:/u);
assert.doesNotMatch(watchdogWorkflow,/schedule:/u);
assert.doesNotMatch(watchdogWorkflow,/workflow_run:/u);
assert.doesNotMatch(watchdogWorkflow,/push:\s*\n\s*branches: \[execution\]/u);
