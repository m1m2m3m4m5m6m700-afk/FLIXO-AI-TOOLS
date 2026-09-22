#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { acquire, proposePush, release } from './chair-bound-execution.mjs';

const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-push-guard-strict-'));
process.env.FLIXO_CHAIR_STATE_PATH=path.join(temp,'chairs.json');
process.env.FLIXO_CHAIR_SIGNING_KEY='strict-push-test-key';
process.env.FLIXO_REQUIRE_FENCED_CHAIR='false';

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
      acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null
    }]))
  },null,2)+'\n'
);

acquire({
  chairId:'chair_2',
  agentId:'strict-push-proposer',
  targetSha:exactSha,
  repositoryState:'IDLE',
  scope:['src/example.ts']
});

assert.throws(
  ()=>proposePush({
    chairId:'chair_2',
    agentId:'strict-push-proposer',
    targetSha:exactSha,
    candidateSha:'b'.repeat(40),
    parentSha:exactSha,
    paths:['src/example.ts'],
    workPackageId:'WP-STRICT-PUSH',
    taskId:'TASK-STRICT-PUSH',
    summary:'missing push details'
  }),
  /CHAIR_PUSH_PATCH_SHA_REQUIRED|CHAIR_PUSH_DETAILS_REQUIRED/
);

const guard=fs.readFileSync(path.join(root,'scripts/ci/chair-push-guard.mjs'),'utf8');
assert.match(guard,/FLIXO-CHAIR-PUSH-PROPOSAL-v2/);
assert.match(guard,/requiredPushFields/);
for (const field of ['pushId','actorAgent','actorRole','sessionId','event','reason','changeType','repository','branch','commitMessage','commitTreeSha','requestedAt','expectedRemoteSha','candidateSha','parentSha']) {
  assert.match(guard,new RegExp('(?:requiredPushFields|details).*'+field));
}
assert.match(guard,/CHAIR_GUARD_CHANGED_PATHS_MISMATCH/);
assert.match(guard,/CHAIR_GUARD_PATCH_DIGEST_MISMATCH/);
assert.match(guard,/CHAIR_GUARD_COMMIT_MESSAGE_MISMATCH/);
assert.match(guard,/CHAIR_GUARD_COMMIT_TREE_MISMATCH/);

release({chairId:'chair_2',agentId:'strict-push-proposer',targetSha:exactSha,successful:false});
console.log('STRICT_PUSH_DETAILS_REQUIRED=PASS');
console.log('STRICT_PUSH_GUARD_V2=PASS');
console.log('STRICT_PUSH_COMMIT_BINDING=PASS');
