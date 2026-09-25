#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const { HEAD_AUTHORITY_PROTOCOL, verifyExecutionHeadAuthority } = await import('./execution-head-authority.mjs');


const read=(file)=>fs.readFileSync(file,'utf8');
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const candidate=git(['rev-parse','HEAD']);
let target;
try { target=git(['rev-parse','HEAD^']); }
catch {
  execFileSync('git',['fetch','--no-tags','--depth=2','origin',candidate],{stdio:'ignore'});
  target=git(['rev-parse','HEAD^']);
}
assert.notEqual(target,candidate);
const proofCore={
  protocol:HEAD_AUTHORITY_PROTOCOL,
  chairId:'chair_1',
  agentId:'chair-test',
  leaseId:'c'.repeat(64),
  taskId:'HEAD-TASK',
  workPackageId:'HEAD-WP',
  targetSha:target,
  parentSha:target,
  candidateSha:candidate,
};
const proof={
  schemaVersion:1,
  ...proofCore,
  phase:'FINAL_PUBLICATION',
  authorized:true,
  exactSha:true,
  proofDigest:createHash('sha256').update(JSON.stringify(proofCore),'utf8').digest('hex')
};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-head-authority-'));
const proofFile=path.join(dir,'proof.json');
fs.writeFileSync(proofFile,JSON.stringify(proof)+'\n');
assert.equal(verifyExecutionHeadAuthority({file:proofFile,targetSha:target,parentSha:target,candidateSha:candidate}).chairId,'chair_1');
assert.throws(()=>verifyExecutionHeadAuthority({file:proofFile,targetSha:target,parentSha:target,candidateSha:'d'.repeat(40)}),/CHAIR1_HEAD_AUTHORITY_SHA_MISMATCH/);
assert.throws(()=>verifyExecutionHeadAuthority({file:proofFile,targetSha:target,parentSha:'e'.repeat(40),candidateSha:candidate}),/CHAIR1_HEAD_AUTHORITY_SHA_MISMATCH/);

const gate=read('scripts/ci/execution-mutation-gate.mjs');
assert.match(gate,/verifyExecutionHeadAuthority/);
assert.match(gate,/FLIXO_HEAD_AUTHORITY_PROOF/);

const publicationWorkflows=['.github/workflows/auto-repair.yml'];
const handoffWorkflow=read('.github/workflows/agent-repair-handoff-gate.yml');
assert.match(handoffWorkflow,/branches:\s*\[main\]/);
assert.match(handoffWorkflow,/permissions:[\s\S]*contents:\s*write/);
assert.match(handoffWorkflow,/git\/refs\/heads\/execution/);
assert.match(handoffWorkflow,/--method PATCH/);
assert.match(handoffWorkflow,/-F force=false/);
assert.match(handoffWorkflow,/execution-head-authority\.mjs verify/);
assert.doesNotMatch(handoffWorkflow,/git\/refs\/heads\/main/);
for(const workflow of publicationWorkflows){
  const text=read(workflow);
  assert.doesNotMatch(text,/git\s+push[^\n]*\bexecution\b/,workflow+' must not publish execution directly');
  assert.match(text,/CHAIR_GUARD_BLOCKED: direct execution publication is forbidden/,workflow+' missing Chair-gated publication block');
  assert.match(text,/EXECUTION_PUBLICATION=BLOCKED_BY_CHAIR_GUARD/,workflow+' missing Chair-gated publication state');
  assert.match(text,/execution-head-authority\.mjs authorize/,workflow+' missing Chair1 head authority');
  assert.match(text,/chair-bound-execution\.mjs authorize-publication/,workflow+' missing Chair1 publication authorization');
  assert.match(text,/CHAIR_GUARD_BLOCKED:/,workflow+' missing Chair-gated publication block');
  assert.match(text,/HANDOFF_REQUIRED:/,workflow+' missing Chair handoff requirement');
}
const executionSync=read('.github/workflows/execution-sync.yml');
assert.match(executionSync,/name:\s*FLIXO Execution Canonical Sync — Chair Proposal Only/u);
assert.match(executionSync,/permissions:[\s\S]*contents:\s*read[\s\S]*actions:\s*read/u);
assert.match(executionSync,/CHAIR_HANDOFF_REQUIRED=true/u);
assert.match(executionSync,/Publish proposal evidence only/u);
assert.doesNotMatch(executionSync,/execution-head-authority\.mjs authorize/u);
assert.doesNotMatch(executionSync,/chair-bound-execution\.mjs authorize-publication/u);
assert.doesNotMatch(executionSync,/git\s+push[^\n]*\b(?:execution|main)\b/u);
const historicalIndex=read('.github/workflows/historical-action-error-index.yml');
assert.match(historicalIndex,/name:\s*FLIXO Historical Action Error Index — Chair Proposal Only/u);
assert.match(historicalIndex,/permissions:[\s\S]*contents:\s*read[\s\S]*actions:\s*read/u);
assert.match(historicalIndex,/Publish historical corpus as proposal evidence only/u);
assert.doesNotMatch(historicalIndex,/execution-head-authority\.mjs authorize/u);
assert.doesNotMatch(historicalIndex,/chair-bound-execution\.mjs authorize-publication/u);
assert.doesNotMatch(historicalIndex,/git\s+push[^\n]*\b(?:execution|main)\b/u);
assert.match(read('scripts/ci/control-plane-registry.mjs'),/execution-head-authority\.mjs/);
assert.match(read('scripts/ci/repair-protocol.mjs'),/execution-head-authority\.mjs/);

console.log('EXECUTION_HEAD_CHANGES_REQUIRE_CHAIR1=PASS');
console.log('EXACT_SHA_HEAD_AUTHORITY=PASS');
console.log('HEAD_AUTHORITY_TAMPER_FAIL_CLOSED=PASS');
console.log('AUTO_REPAIR_HEAD_AUTHORITY=PASS');
console.log('EXECUTION_SYNC_PROPOSAL_ONLY=PASS');
console.log('HISTORICAL_INDEX_PROPOSAL_ONLY=PASS');
console.log('HEAD_AUTHORITY_REGISTERED=PASS');

const cliSource=read('scripts/ci/execution-head-authority.mjs');
assert.match(cliSource,/isDirectCliEntry/);
assert.match(cliSource,/pathToFileURL\(process\.argv\[1\]\)\.href/);
assert.doesNotMatch(cliSource,/endsWith\('execution-head-authority\.mjs'\)/);
console.log('HEAD_AUTHORITY_IMPORT_NO_CLI_SIDE_EFFECT=PASS');
