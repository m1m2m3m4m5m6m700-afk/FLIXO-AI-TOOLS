#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { acquire, proposePush, release, CHAIR1_OWNER_AGENT } from './chair-bound-execution.mjs';

const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-push-guard-strict-'));
process.env.FLIXO_CHAIR_STATE_PATH=path.join(temp,'chairs.json');
process.env.FLIXO_CHAIR_SIGNING_KEY='strict-push-test-key';
process.env.FLIXO_REQUIRE_FENCED_CHAIR='false';
process.env.FLIXO_CHAIR_TEST_LOCAL_AUTH='true';

const exactSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
fs.writeFileSync(
  process.env.FLIXO_CHAIR_STATE_PATH,
  JSON.stringify({
    schemaVersion:1,
    authority:'FLIXO_CHAIR_BOUND_EXECUTION',
    repository_state:'IDLE',
    idle_timestamp:new Date().toISOString(),
    target_sha:exactSha,
    chairs:Object.fromEntries(['chair_1','chair_2','chair_3'].map((id)=>[id,{
      holder_agent_id:null,status:'VACANT',permissions:[],
      acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null,
      scope_hash:null,work_package_id:null,task_id:null,fencing_token:null,
      lease_started_at:null,heartbeat_at:null,heartbeat_count:0
    }]))
  },null,2)+'\n'
);

acquire({chairId:'chair_2',agentId:'strict-push-proposer',targetSha:exactSha,repositoryState:'IDLE',scope:['src/example.ts']});

assert.throws(
  ()=>proposePush({
    chairId:'chair_2',agentId:'strict-push-proposer',targetSha:exactSha,
    candidateSha:'b'.repeat(40),parentSha:exactSha,paths:['src/example.ts'],
    workPackageId:'WP-STRICT-PUSH',taskId:'TASK-STRICT-PUSH',summary:'missing push details'
  }),
  /CHAIR_PUSH_PATCH_SHA_REQUIRED|CHAIR_PUSH_DETAILS_REQUIRED/
);

const guard=fs.readFileSync(path.join(root,'scripts/ci/chair-push-guard.mjs'),'utf8');
assert.throws(
  ()=>proposePush({
    chairId:'chair_2',agentId:'strict-push-proposer',targetSha:exactSha,
    candidateSha:'c'.repeat(40),parentSha:exactSha,paths:['src/example.ts'],
    workPackageId:'WP-STRICT-PUSH',taskId:'TASK-STRICT-PUSH',patchSha256:'d'.repeat(64),
    pushDetails:{pushId:'PUSH-STRICT-UNIFIED-NEGATIVE',actorAgent:'strict-push-proposer',actorRole:'chair_2',sessionId:'SESSION-STRICT',
      event:'PUSH',reason:'negative gate test',changeType:'INCREMENTAL_PUSH',repository:'m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS',branch:'execution',
      commitMessage:'negative test',commitTreeSha:'e'.repeat(64),requestedAt:new Date().toISOString(),commitCount:2,aggregateId:'AGG-NEGATIVE'}
  }),
  /CHAIR_PUSH_GATE_CLOSED_INCREMENTAL_PUSH/
);

assert.match(guard,/FLIXO-CHAIR-PUSH-PROPOSAL-v2/);
assert.match(guard,/FLIXO-CHAIR-PUSH-VALIDATOR-v1/);
assert.match(guard,/authority:'VALIDATION_ONLY'/);
assert.match(guard,/decisionAuthority:'assistantController'/);
assert.match(guard,/decision:null/);
assert.match(guard,/CHAIR_GUARD_PUSH_GATE_CLOSED_INCREMENTAL_PUSH/);
assert.match(guard,/UNIFIED_ACCUMULATED_COMMIT/);
assert.doesNotMatch(guard,/decision:'ACCEPTED'/);
assert.doesNotMatch(guard,/decision:'REJECTED'/);
assert.doesNotMatch(guard,/READY_FOR_CHAIR_1/);
assert.doesNotMatch(guard,/recordGuardDecision/);

assert.equal(CHAIR1_OWNER_AGENT,'assistantController');
release({chairId:'chair_2',agentId:'strict-push-proposer',targetSha:exactSha,successful:false});
console.log('STRICT_PUSH_DETAILS_REQUIRED=PASS');
console.log('STRICT_PUSH_GUARD_VALIDATION_ONLY=PASS');
