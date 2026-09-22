#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {acquire,authorizeWrite,authorizeMergeProposal,release,repositoryMode,heartbeat,reconcileDeadLeases,writeSpeculativeContext,readSpeculativeContext,sanitizeSessionContext,atomicChairRefAudit} from './chair-bound-execution.mjs';

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

const one=acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE'});
assert.equal(one.chairs.chair_1.status,'OCCUPIED');
assert.equal(repositoryMode({targetSha:realGitSha}).singleAgentMode,true);
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-beta',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}),/UNAUTHORIZED_EXECUTION_ATTEMPT/);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['.github/workflows/ci.yml'],permission:'SOURCE_MUTATION'}),/CHAIR_PROTECTED_PATH/);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:SHA2,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}),/STALE_CONTEXT/);
assert.equal(authorizeMergeProposal({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha}).requiresPromotionGate,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'MERGE_PROPOSAL'}),/MERGE_PROPOSAL_IS_NOT_MERGE_AUTHORITY/);
release({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,successful:true});
assert.equal(repositoryMode({targetSha:realGitSha}).repositoryState,'IDLE');

acquire({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,repositoryState:'IDLE'});
assert.equal(authorizeWrite({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,paths:['src/other.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}),/CHAIR2_SCOPE_DRIFT/);
release({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha});

acquire({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,repositoryState:'IDLE',reviewId:'AR-001'});
assert.equal(authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['schemas/example.json'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['src/example.ts'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}),/CHAIR_SCOPE_DENIED/);
release({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha});

acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE'});
const chair3Parallel=acquire({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha,repositoryState:'ACTIVE',reviewId:'AR-002'});
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION'}).authorized,true);
assert.equal(authorizeWrite({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha,paths:['schemas/example.json'],permission:'SCHEMA_VALIDATION',reviewId:'AR-002'}).authorized,true);
assert.equal(chair3Parallel.repository_state,'ACTIVE');

release({chairId:'chair_3',agentId:'agent-arch-2',targetSha:realGitSha});

const chair2Parallel=acquire({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha,repositoryState:'ACTIVE'});
assert.equal(chair2Parallel.chairs.chair_2.status,'OCCUPIED');
assert.throws(()=>authorizeWrite({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}),/CHAIR2_WRITE_BLOCKED_WHILE_CHAIR1_ACTIVE/);
assert.equal(repositoryMode({targetSha:realGitSha}).singleAgentMode,false);
release({chairId:'chair_2',agentId:'agent-beta-2',targetSha:realGitSha});

release({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha});

const hardeningRoot=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair-hardening-'));
process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_PATH=path.join(hardeningRoot,'readonly');
process.env.FLIXO_CHAIR_SESSION_CONTEXT_PATH=path.join(hardeningRoot,'session');
process.env.FLIXO_CHAIR_REF_PREFIX=`refs/flixo/tests/chair-${process.pid}`;
acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE'});
const hb=heartbeat({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha});
assert.equal(hb.heartbeatCount,1);
const stateFile=process.env.FLIXO_CHAIR_STATE_PATH;
const stale=JSON.parse(fs.readFileSync(stateFile,'utf8'));
stale.chairs.chair_1.heartbeat_at=new Date(Date.now()-120_000).toISOString();
fs.writeFileSync(stateFile,JSON.stringify(stale,null,2)+'\n');
const dead=reconcileDeadLeases({targetSha:realGitSha});
assert.equal(dead.reclaimed.length,1);
assert.equal(dead.reclaimed[0].reason,'DEAD_LEASE');
acquire({chairId:'chair_1',agentId:'agent-alpha',targetSha:realGitSha,repositoryState:'IDLE'});
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
process.env.FLIXO_REQUIRE_FENCED_CHAIR='true';
const fencedToken='d'.repeat(64);
acquire({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,repositoryState:'IDLE',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:fencedToken,scope:['src/fenced.ts']});
assert.equal(authorizeWrite({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,paths:['src/fenced.ts'],permission:'SOURCE_MUTATION',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:fencedToken}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,paths:['src/fenced.ts'],permission:'SOURCE_MUTATION',workPackageId:'WP-FENCED',taskId:'TASK-FENCED',fencingToken:'e'.repeat(64)}),/CHAIR_FENCING_TOKEN_MISMATCH/);
release({chairId:'chair_1',agentId:'fenced-agent',targetSha:realGitSha,successful:true});
console.log('CHAIR_FENCING_TOKEN=PASS');
console.log('CHAIR_HEARTBEAT_MICRO_LEASE=PASS');
console.log('CHAIR_DEAD_LEASE_RECOVERY=PASS');
console.log('CHAIR_READ_ONLY_SPECULATION=PASS');
console.log('CHAIR_CONTEXT_SANITIZATION=PASS');
console.log('CHAIR_ATOMIC_REF_AUDIT_CAS=PASS');
console.log('CHAIR_SINGLE_AGENT_MODE=PASS');
console.log('CHAIR_EXACT_SHA=PASS');
console.log('CHAIR_SINGLE_WRITER=PASS');
console.log('CHAIR_SCOPE_BOUNDARY=PASS');
console.log('CHAIR_MERGE_SEPARATION=PASS');
console.log('CHAIR2_BOUNDED_REPAIR=PASS');
console.log('CHAIR3_ARCHITECTURE_SCOPE=PASS');
