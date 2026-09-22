#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {acquire,authorizeWrite,authorizeMergeProposal,release,repositoryMode,heartbeat,reconcileDeadLeases,writeSpeculativeContext,readSpeculativeContext,sanitizeSessionContext,atomicChairRefAudit,proposePush,beginWork,endWork,assertWorkAdmission,activeChairForAgent,preemptedContinuityForAgent,reclaimChair1} from './chair-bound-execution.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair-test-'));
process.env.FLIXO_CHAIR_STATE_PATH=path.join(temp,'locks','chairs.json');
process.env.FLIXO_CHAIR_SIGNING_KEY='test-chair-signing-key';
const SHA='a'.repeat(40),SHA2='b'.repeat(40);

const realGitSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.notEqual(realGitSha, SHA);
fs.mkdirSync(path.dirname(process.env.FLIXO_CHAIR_STATE_PATH),{recursive:true});
fs.writeFileSync(process.env.FLIXO_CHAIR_STATE_PATH,JSON.stringify({
  schemaVersion:1,authority:'FLIXO_CHAIR_BOUND_EXECUTION',repository_state:'IDLE',idle_timestamp:new Date().toISOString(),target_sha:realGitSha,
  chairs:Object.fromEntries(['chair_1','chair_2','chair_3'].map(id=>[id,{holder_agent_id:null,status:'VACANT',permissions:[],acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null}]))
},null,2)+'\n');

assert.throws(()=>assertWorkAdmission({agentId:'agent-no-chair',targetSha:realGitSha}),/AGENT_WORK_REQUIRES_CHAIR/);
const autoAdmission=beginWork({agentId:'agent-auto-chair',targetSha:realGitSha,repositoryState:'IDLE',taskId:'TASK-AUTO-CHAIR',workPackageId:'WP-AUTO-CHAIR',scope:['src/auto.ts']});
assert.equal(autoAdmission.admitted,true);
assert.equal(autoAdmission.chairId,'chair_1');
assert.equal(activeChairForAgent({agentId:'agent-auto-chair',targetSha:realGitSha}).chairId,'chair_1');
assert.equal(endWork({agentId:'agent-auto-chair',targetSha:realGitSha,successful:true,taskId:'TASK-AUTO-CHAIR'}).repository_state,'IDLE');
assert.throws(()=>assertWorkAdmission({agentId:'agent-auto-chair',targetSha:realGitSha}),/AGENT_WORK_REQUIRES_CHAIR/);

const one=acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE',taskId:'CHAIR1-ALPHA-TASK',workPackageId:'CHAIR1-ALPHA-WP'});
assert.equal(one.chairs.chair_1.status,'OCCUPIED');
assert.equal(repositoryMode({targetSha:realGitSha}).singleAgentMode,true);
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',workPackageId:'CHAIR1-ALPHA-WP',taskId:'CHAIR1-ALPHA-TASK'}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-beta',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}),/UNAUTHORIZED_EXECUTION_ATTEMPT/);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['.github/workflows/ci.yml'],permission:'SOURCE_MUTATION',workPackageId:'CHAIR1-ALPHA-WP',taskId:'CHAIR1-ALPHA-TASK'}),/CHAIR_PROTECTED_PATH/);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:SHA2,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}),/STALE_CONTEXT/);
assert.equal(authorizeMergeProposal({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha}).requiresPromotionGate,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'MERGE_PROPOSAL',workPackageId:'CHAIR1-ALPHA-WP',taskId:'CHAIR1-ALPHA-TASK'}),/MERGE_PROPOSAL_IS_NOT_MERGE_AUTHORITY/);
release({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,successful:true});
assert.equal(repositoryMode({targetSha:realGitSha}).repositoryState,'IDLE');

acquire({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,repositoryState:'IDLE'});
assert.throws(()=>authorizeWrite({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}),/CHAIR_PERMISSION_DENIED=SOURCE_MUTATION/);
release({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha});

acquire({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,repositoryState:'IDLE',reviewId:'AR-001'});
assert.equal(authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['schemas/example.json'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['src/example.ts'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}),/CHAIR_SCOPE_DENIED/);
release({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha});

acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE',taskId:'CHAIR1-ALPHA-TASK',workPackageId:'CHAIR1-ALPHA-WP'});
const chair3Parallel=acquire({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha,repositoryState:'ACTIVE',reviewId:'AR-002'});
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',workPackageId:'CHAIR1-ALPHA-WP',taskId:'CHAIR1-ALPHA-TASK'}).authorized,true);
assert.equal(authorizeWrite({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha,paths:['schemas/example.json'],permission:'SCHEMA_VALIDATION',reviewId:'AR-002'}).authorized,true);
assert.equal(chair3Parallel.repository_state,'ACTIVE');

release({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha});

const chair2Parallel=acquire({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha,repositoryState:'ACTIVE'});
assert.equal(chair2Parallel.chairs.chair_2.status,'OCCUPIED');
assert.throws(()=>authorizeWrite({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}),/CHAIR_PERMISSION_DENIED=SOURCE_MUTATION/);
assert.equal(repositoryMode({targetSha:realGitSha}).singleAgentMode,false);
release({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha});

release({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,successful:true,taskId:'CHAIR1-ALPHA-TASK'});

const hardeningRoot=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair-hardening-'));
process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_PATH=path.join(hardeningRoot,'readonly');
process.env.FLIXO_CHAIR_SESSION_CONTEXT_PATH=path.join(hardeningRoot,'session');
process.env.FLIXO_CHAIR_REF_PREFIX=`refs/flixo/tests/chair-${process.pid}`;
acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE',taskId:'CHAIR1-ALPHA-TASK',workPackageId:'CHAIR1-ALPHA-WP'});
const hb=heartbeat({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha});
assert.equal(hb.heartbeatCount,1);
const stateFile=process.env.FLIXO_CHAIR_STATE_PATH;
const stale=JSON.parse(fs.readFileSync(stateFile,'utf8'));
stale.chairs.chair_1.heartbeat_at=new Date(Date.now()-120_000).toISOString();
fs.writeFileSync(stateFile,JSON.stringify(stale,null,2)+'\n');
const dead=reconcileDeadLeases({targetSha:realGitSha});
assert.equal(dead.reclaimed.length,1);
assert.equal(dead.reclaimed[0].reason,'DEAD_LEASE');
acquire({
  chairId:'chair_1',
  agentId:'task-active-agent',
  targetSha:realGitSha,
  repositoryState:'IDLE',
  taskId:'TASK-ACTIVE-NONRECLAIM',
  workPackageId:'WP-ACTIVE-NONRECLAIM'
});
const stateWithActiveTask=JSON.parse(fs.readFileSync(stateFile,'utf8'));
stateWithActiveTask.chairs.chair_1.heartbeat_at=new Date(Date.now()-120_000).toISOString();
fs.writeFileSync(stateFile,JSON.stringify(stateWithActiveTask,null,2)+'\n');
const blockedDead=reconcileDeadLeases({targetSha:realGitSha});
assert.equal(blockedDead.reclaimed.length,0);
assert.equal(blockedDead.blocked[0].reason,'TASK_ACTIVE_NONRECLAIMABLE');
assert.equal(activeChairForAgent({agentId:'task-active-agent',targetSha:realGitSha}).chairId,'chair_1');
assert.throws(()=>release({chairId:'chair_1',agentId:'task-active-agent',targetSha:realGitSha,successful:false}),/CHAIR1_TASK_ACTIVE_NONRELEASABLE/);
assert.throws(
  ()=>beginWork({
    agentId:'MASTER-2',
    role:'MASTER-2',
    requestedChairId:'chair_1',
    targetSha:realGitSha,
    repositoryState:'IDLE',
    taskId:'MASTER-2-PREEMPT-TRIAL',
    workPackageId:'MASTER-2-PREEMPT-WP'
  }),
  /CHAIR1_ACTIVE_DELEGATION/
);
const blockedPreemption=preemptedContinuityForAgent({agentId:'task-active-agent',targetSha:realGitSha,taskId:'TASK-ACTIVE-NONRECLAIM'});
assert.equal(blockedPreemption,null);
assert.throws(
  ()=>reclaimChair1({agentId:'MASTER-2',targetSha:realGitSha,reason:'NOT_USER_DIRECT_COMMAND'}),
  /CHAIR1_RECLAIM_CONTROLLER_ONLY/
);
const reclaimed=reclaimChair1({
  agentId:'assistantController',
  targetSha:realGitSha,
  reason:'USER_DIRECT_COMMAND: reclaim Chair-1'
});
assert.equal(reclaimed.reclaimed,true);
assert.equal(reclaimed.ownerAgentId,'assistantController');
assert.equal(reclaimed.custodyStatus,'OWNER_CUSTODY');
assert.equal(reclaimed.displaced.agentId,'task-active-agent');
assert.throws(()=>activeChairForAgent({agentId:'task-active-agent',targetSha:realGitSha}),/AGENT_WORK_REQUIRES_CHAIR/);
assert.throws(
  ()=>acquire({chairId:'chair_1',agentId:'agent-without-task',targetSha:realGitSha,repositoryState:'IDLE'}),
  /CHAIR1_TASK_DELEGATION_REQUIRED/
);
acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE',taskId:'CHAIR1-ALPHA-TASK',workPackageId:'CHAIR1-ALPHA-WP'});
const speculative=writeSpeculativeContext({sessionId:'session-2',taskId:'TASK-2',chairId:'chair_2',role:'verification',targetSha:realGitSha,pendingDiff:'diff --git a/src/example.ts b/src/example.ts',testPlan:['lint','unit']});
assert.equal(speculative.readOnly,true);
assert.equal(readSpeculativeContext({sessionId:'session-2',targetSha:realGitSha}).taskId,'TASK-2');
sanitizeSessionContext({sessionId:'session-2',taskId:'TASK-2'});
assert.throws(()=>readSpeculativeContext({sessionId:'session-2',targetSha:realGitSha}),/CHAIR_SPECULATION_CONTEXT_MISSING/);
const refAudit=atomicChairRefAudit({chairId:'chair_1',targetSha:realGitSha,event:'TEST_ACQUIRE'});
assert.equal(refAudit.atomicLocalCAS,true);
assert.throws(()=>atomicChairRefAudit({chairId:'chair_1',targetSha:realGitSha,expectedOldSha:'c'.repeat(40)}),/CHAIR_REF_COMPARE_FAILED/);
execFileSync('git',['update-ref','-d',refAudit.ref],{encoding:'utf8'});
writeSpeculativeContext({sessionId:'release-session',taskId:'RELEASE-TASK',chairId:'chair_2',role:'verification',targetSha:realGitSha,pendingDiff:'release-sanitization',testPlan:['cleanup']});
assert.equal(readSpeculativeContext({sessionId:'release-session',targetSha:realGitSha}).taskId,'RELEASE-TASK');
release({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,successful:true,sessionId:'release-session',taskId:'RELEASE-TASK'});
assert.throws(()=>readSpeculativeContext({sessionId:'release-session',targetSha:realGitSha}),/CHAIR_SPECULATION_CONTEXT_MISSING/);

// Auto Repair is a Chair-system participant, but connected Masters can preempt Chair-1.
const autoRepairAdmission=beginWork({
  agentId:'AUTO_REPAIR_BOT',
  role:'repairAgent',
  targetSha:realGitSha,
  repositoryState:'IDLE',
  taskId:'AUTO-REPAIR-TASK',
  workPackageId:'AUTO-REPAIR-WP',
  scope:['src/example.ts']
});
assert.equal(autoRepairAdmission.chairId,'chair_1');
assert.equal(activeChairForAgent({agentId:'AUTO_REPAIR_BOT',targetSha:realGitSha}).chairId,'chair_1');

assert.throws(
  ()=>beginWork({
    agentId:'MASTER-2',
    role:'MASTER-2',
    requestedChairId:'chair_1',
    targetSha:realGitSha,
    repositoryState:'IDLE',
    taskId:'MASTER-2-TASK',
    workPackageId:'MASTER-2-WP'
  }),
  /CHAIR1_ACTIVE_DELEGATION/
);
assert.equal(
  activeChairForAgent({agentId:'AUTO_REPAIR_BOT',targetSha:realGitSha}).chairId,
  'chair_1'
);
assert.throws(
  ()=>beginWork({
    agentId:'AUTO_REPAIR_BOT',
    targetSha:realGitSha,
    requestedChairId:'chair_1',
    repositoryState:'ACTIVE',
    taskId:'AUTO-REPAIR-TASK-OTHER',
    workPackageId:'AUTO-REPAIR-WP-OTHER'
  }),
  /CHAIR1_ACTIVE_DELEGATION/
);
release({chairId:'chair_1',agentId:'AUTO_REPAIR_BOT',targetSha:realGitSha,successful:true,taskId:'AUTO-REPAIR-TASK',sessionId:null});
const afterAutoReturn=repositoryMode({targetSha:realGitSha});
assert.equal(afterAutoReturn.chair1Owner,'assistantController');
assert.equal(afterAutoReturn.chair1CustodyStatus,'OWNER_CUSTODY');
assert.equal(afterAutoReturn.chair1AutoReturn,true);
assert.equal(afterAutoReturn.repositoryState,'IDLE');
assert.throws(
  ()=>authorizeWrite({chairId:'chair_1',agentId:'AUTO_REPAIR_BOT',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}),
  /CHAIR_NOT_OCCUPIED|UNAUTHORIZED_EXECUTION_ATTEMPT/
);
assert.throws(()=>assertWorkAdmission({agentId:'AUTO_REPAIR_BOT',targetSha:realGitSha,chairId:'chair_1',taskId:'AUTO-REPAIR-TASK'}),/AGENT_WORK_REQUIRES_CHAIR/);
const master3Admission=beginWork({
  agentId:'MASTER-3',
  role:'MASTER-3',
  requestedChairId:'chair_1',
  targetSha:realGitSha,
  repositoryState:'ACTIVE',
  taskId:'MASTER-3-TASK',
  workPackageId:'MASTER-3-WP'
});
assert.equal(master3Admission.chairId,'chair_1');
assert.equal(master3Admission.preemptedAgentId,'MASTER-2');

const master2Continuity=preemptedContinuityForAgent({agentId:'MASTER-2',targetSha:realGitSha,taskId:'MASTER-2-TASK'});
assert.equal(master2Continuity.canContinueTask,true);
assert.equal(master2Continuity.canMutateAfterPreemption,false);
assert.equal(master2Continuity.handoffTo,'CHAIR_1_GUARD');

const ordinaryTakeover=beginWork({
  agentId:'ordinary-worker',
  role:'worker',
  requestedChairId:'chair_1',
  targetSha:realGitSha,
  repositoryState:'ACTIVE',
  taskId:'ORDINARY-TAKEOVER-TASK',
  workPackageId:'ORDINARY-TAKEOVER-WP'
});
assert.equal(ordinaryTakeover.chairId,'chair_1');
assert.equal(ordinaryTakeover.preemptedAgentId,'MASTER-3');
const master2AfterOrdinaryTakeover=preemptedContinuityForAgent({
  agentId:'MASTER-2',
  targetSha:realGitSha,
  taskId:'MASTER-2-TASK'
});
assert.equal(master2AfterOrdinaryTakeover.canContinueTask,true);
assert.equal(master2AfterOrdinaryTakeover.canMutateAfterPreemption,false);
assert.equal(master2AfterOrdinaryTakeover.handoffTo,'CHAIR_1_GUARD');
assert.deepEqual(
  assertWorkAdmission({agentId:'MASTER-2',targetSha:realGitSha,chairId:'chair_1',taskId:'MASTER-2-TASK'}),
  master2AfterOrdinaryTakeover
);

const master1Admission=beginWork({
  agentId:'MASTER-1',
  role:'MASTER-1',
  requestedChairId:'chair_1',
  targetSha:realGitSha,
  repositoryState:'ACTIVE',
  taskId:'MASTER-1-TASK',
  workPackageId:'MASTER-1-WP'
});
assert.equal(master1Admission.preemptedAgentId,'ordinary-worker');
assert.equal(activeChairForAgent({agentId:'MASTER-1',targetSha:realGitSha}).chairId,'chair_1');
assert.deepEqual(
  assertWorkAdmission({agentId:'ordinary-worker',targetSha:realGitSha,chairId:'chair_1',taskId:'ORDINARY-TAKEOVER-TASK'}),
  preemptedContinuityForAgent({agentId:'ordinary-worker',targetSha:realGitSha,taskId:'ORDINARY-TAKEOVER-TASK'})
);
release({chairId:'chair_1',agentId:'MASTER-1',targetSha:realGitSha,successful:true});

process.env.FLIXO_REQUIRE_FENCED_CHAIR='true';
const fencedToken='d'.repeat(64);
acquire({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,repositoryState:'IDLE',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:fencedToken,scope:['src/fenced.ts']});
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,paths:['src/fenced.ts'],permission:'SOURCE_MUTATION',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:fencedToken}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,paths:['src/fenced.ts'],permission:'SOURCE_MUTATION',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:'e'.repeat(64)}),/CHAIR_FENCING_TOKEN_MISMATCH/);
release({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,successful:true});
acquire({chairId:'chair_1',agentId:'agent-chair1-active',targetSha:realGitSha,repositoryState:'IDLE',workPackageId:'WP-CHAIR1-ACTIVE',taskId:'TASK-CHAIR1-ACTIVE',fencingToken:'f'.repeat(64)});
const proposalFile=path.join(hardeningRoot,'push-proposal.json');
writeSpeculativeContext({
  sessionId:'push-proposal-session',
  taskId:'PUSH-TASK-1',
  chairId:'chair_2',
  role:'verification',
  targetSha:realGitSha,
  pendingDiff:'proposal-only'
});
acquire({chairId:'chair_2',agentId:'agent-proposer',targetSha:realGitSha,repositoryState:'IDLE',scope:['src/example.ts']});
const pushProposal=proposePush({
  chairId:'chair_2',
  agentId:'agent-proposer',
  targetSha:realGitSha,
  candidateSha:'b'.repeat(40),
  parentSha:realGitSha,
  paths:['src/example.ts'],
  workPackageId:'WP-PUSH-1',
  taskId:'TASK-PUSH-1',
  summary:'Chair-2 proposed source push; guard must review before Chair-1 adoption.'
});
fs.writeFileSync(proposalFile,JSON.stringify(pushProposal,null,2)+'\n');
const guardOut=path.join(hardeningRoot,'guard.json');
const guardMem=path.join(hardeningRoot,'rejected-push-memory.jsonl');
execFileSync(process.execPath,['scripts/ci/chair-push-guard.mjs','--proposal='+proposalFile,'--sha='+realGitSha,'--output='+guardOut,'--memory-output='+guardMem],{
  env:{...process.env,FLIXO_CHAIR_STATE_PATH:process.env.FLIXO_CHAIR_STATE_PATH,FLIXO_GUARD_REMOTE_SHA:realGitSha,FLIXO_CHAIR_SIGNING_KEY:'test-chair-signing-key'}
});
const guardReport=JSON.parse(fs.readFileSync(guardOut,'utf8'));
assert.equal(guardReport.decision,'REJECTED');
assert.equal(guardReport.reasonCode,'CHAIR1_ACTIVE_CONFLICT');
assert.equal(fs.readFileSync(guardMem,'utf8').trim().length>0,true);
const finalState=JSON.parse(fs.readFileSync(process.env.FLIXO_CHAIR_STATE_PATH,'utf8'));
assert.equal(finalState.rejected_push_memory.at(-1).proposalId,pushProposal.proposalId);
release({chairId:'chair_2',agentId:'agent-proposer',targetSha:realGitSha});
release({chairId:'chair_1',agentId:'agent-chair1-active',targetSha:realGitSha,successful:true});
sanitizeSessionContext({sessionId:'push-proposal-session',taskId:'PUSH-TASK-1'});
console.log('CHAIR_PUSH_PROPOSAL_ONLY=PASS');
console.log('CHAIR_PUSH_GUARD=PASS');
console.log('REJECTED_PUSH_MEMORY=PASS');
console.log('CHAIR_FENCING_TOKEN=PASS');
console.log('CHAIR_HEARTBEAT_MICRO_LEASE=PASS');
console.log('CHAIR_DEAD_LEASE_RECOVERY=PASS');
console.log('CHAIR_READ_ONLY_SPECULATION=PASS');
console.log('CHAIR_CONTEXT_SANITIZATION=PASS');
console.log('CHAIR_ATOMIC_REF_AUDIT_CAS=PASS');
console.log('CHAIR_SINGLE_AGENT_MODE=PASS');
console.log('CHAIR1_TASK_NONRECLAIMABLE=PASS');
console.log('CHAIR1_TASK_PREEMPTION_CONTINUES=PASS');
console.log('CHAIR1_ANY_AGENT_TAKEOVER=PASS');
console.log('CHAIR1_PREEMPTED_MUTATION_REVOKED=PASS');
console.log('CHAIR1_GUARD_HANDOFF=PASS');
console.log('CHAIR1_RELEASE_REQUIRES_COMPLETION=PASS');
console.log('CHAIR_EXACT_SHA=PASS');
console.log('CHAIR1_CENTRAL_OWNER=PASS');
console.log('CHAIR1_TASK_DELEGATION_REQUIRED=PASS');
console.log('CHAIR1_PREEMPTION_BLOCKED=PASS');
console.log('CHAIR1_USER_ONLY_RECLAIM=PASS');
console.log('CHAIR1_AUTO_RETURN=PASS');
console.log('CHAIR_SINGLE_WRITER=PASS');
console.log('CHAIR_SCOPE_BOUNDARY=PASS');
console.log('CHAIR_MERGE_SEPARATION=PASS');
console.log('CHAIR2_BOUNDED_REPAIR=PASS');
console.log('CHAIR3_ARCHITECTURE_SCOPE=PASS');
console.log('CHAIR3_ARCHITECTURE_SCOPE=PASS');