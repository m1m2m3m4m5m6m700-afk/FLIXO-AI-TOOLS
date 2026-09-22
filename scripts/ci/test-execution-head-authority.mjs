#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { verifyExecutionHeadAuthority } = await import('./execution-head-authority.mjs');


const read=(file)=>fs.readFileSync(file,'utf8');
const target='a'.repeat(40);
const candidate='b'.repeat(40);
const proof={
  schemaVersion:1,
  protocol:'FLIXO-CHAIR1-EXECUTION-HEAD-AUTHORITY-v1',
  authorized:true,
  chairId:'chair_1',
  agentId:'chair-test',
  leaseId:'c'.repeat(64),
  taskId:'HEAD-TASK',
  workPackageId:'HEAD-WP',
  targetSha:target,
  parentSha:target,
  candidateSha:candidate,
  exactSha:true
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

const workflows=[
  '.github/workflows/auto-repair.yml',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/historical-action-error-index.yml',
];
for(const workflow of workflows){
  const text=read(workflow);
  if(workflow === '.github/workflows/auto-repair.yml'){
    assert.doesNotMatch(text,/git\\s+push[^\\n]*\\bexecution\\b/,workflow+' must not publish execution directly');
    assert.match(text,/CHAIR_GUARD_BLOCKED: direct execution publication is forbidden/,workflow+' missing Chair-gated publication block');
    assert.match(text,/EXECUTION_PUBLICATION=BLOCKED_BY_CHAIR_GUARD/,workflow+' missing Chair-gated publication state');
  } else {
    assert.match(text,/git push origin(?: "HEAD:execution"| execution)/,workflow+' missing execution push surface');
  }
  assert.match(text,/execution-head-authority\.mjs authorize/,workflow+' missing Chair1 head authority');
  assert.match(text,/chair-bound-execution\.mjs authorize-publication/,workflow+' missing Chair1 publication authorization');
}

assert.match(read('scripts/ci/control-plane-registry.mjs'),/execution-head-authority\.mjs/);
assert.match(read('scripts/ci/repair-protocol.mjs'),/execution-head-authority\.mjs/);

console.log('EXECUTION_HEAD_CHANGES_REQUIRE_CHAIR1=PASS');
console.log('EXACT_SHA_HEAD_AUTHORITY=PASS');
console.log('HEAD_AUTHORITY_TAMPER_FAIL_CLOSED=PASS');
console.log('AUTO_REPAIR_HEAD_AUTHORITY=PASS');
console.log('EXECUTION_SYNC_HEAD_AUTHORITY=PASS');
console.log('HISTORICAL_INDEX_HEAD_AUTHORITY=PASS');
console.log('HEAD_AUTHORITY_REGISTERED=PASS');

const cliSource=read('scripts/ci/execution-head-authority.mjs');
assert.match(cliSource,/isDirectCliEntry/);
assert.match(cliSource,/pathToFileURL\(process\.argv\[1\]\)\.href/);
assert.doesNotMatch(cliSource,/endsWith\('execution-head-authority\.mjs'\)/);
console.log('HEAD_AUTHORITY_IMPORT_NO_CLI_SIDE_EFFECT=PASS');
