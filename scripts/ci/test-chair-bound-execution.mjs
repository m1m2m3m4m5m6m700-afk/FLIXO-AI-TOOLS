#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {initialize,acquire,authorizeWrite,authorizeMergeProposal,release,repositoryMode} from './chair-bound-execution.mjs';

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

const two=acquire({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,repositoryState:'IDLE'});
assert.equal(authorizeWrite({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,paths:['src/example.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha,paths:['src/other.ts'],permission:'SOURCE_MUTATION',boundedScope:['src/example.ts']}),/CHAIR2_SCOPE_DRIFT/);
release({chairId:'chair_2',agentId:'agent-beta',targetSha:realGitSha});

const three=acquire({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,repositoryState:'IDLE',reviewId:'AR-001'});
assert.equal(authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['schemas/example.json'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}).authorized,true);
assert.throws(()=>authorizeWrite({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha,paths:['src/example.ts'],permission:'SCHEMA_VALIDATION',reviewId:'AR-001'}),/CHAIR_SCOPE_DENIED/);
release({chairId:'chair_3',agentId:'agent-arch',targetSha:realGitSha});

console.log('CHAIR_EXECUTION_CONTRACT=PASS');
console.log('CHAIR_SINGLE_AGENT_MODE=PASS');
console.log('CHAIR_EXACT_SHA=PASS');
console.log('CHAIR_SINGLE_WRITER=PASS');
console.log('CHAIR_SCOPE_BOUNDARY=PASS');
console.log('CHAIR_MERGE_SEPARATION=PASS');
console.log('CHAIR2_BOUNDED_REPAIR=PASS');
console.log('CHAIR3_ARCHITECTURE_SCOPE=PASS');
