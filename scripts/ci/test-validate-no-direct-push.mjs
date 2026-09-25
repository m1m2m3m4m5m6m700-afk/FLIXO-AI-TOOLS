#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const script=path.join(root,'scripts/ci/validate-no-direct-push.mjs');
const registry=path.join(root,'scripts/ci/control-plane-registry.mjs');

function run({workflowName,contents,expectedPass,expectedReason}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-no-direct-push-'));
  const workflows=path.join(dir,'.github','workflows');
  const ci=path.join(dir,'scripts','ci');
  fs.mkdirSync(workflows,{recursive:true});
  fs.mkdirSync(ci,{recursive:true});
  fs.copyFileSync(registry,path.join(ci,'control-plane-registry.mjs'));
  fs.writeFileSync(path.join(workflows,'test-orig.yml'),fs.readFileSync(path.join(root,'.github','workflows','ci.yml'),'utf8'));
  fs.writeFileSync(path.join(workflows,workflowName),contents);
  fs.copyFileSync(script,path.join(ci,'validate-no-direct-push.mjs'));
  const result=spawnSync(process.execPath,[path.join(ci,'validate-no-direct-push.mjs')],{cwd:dir,encoding:'utf8',env:{...process.env}});
  const parsed=JSON.parse(result.stdout);
  assert.equal(parsed.pass,expectedPass,workflowName);
  if(expectedReason) assert.equal(parsed.offenders.some(x=>x.reason===expectedReason),true,workflowName+':'+expectedReason);
}

run({
  workflowName:'agent-repair-handoff-gate.yml',
  contents:['permissions:','  contents: write','run: |','  gh api --method PATCH repos/x/git/refs/heads/execution -f sha=ABC -F force=false','  node scripts/ci/execution-mutation-gate.mjs verify','  node scripts/ci/execution-head-authority.mjs verify'].join('\n'),
  expectedPass:true
});
run({
  workflowName:'daily-flixo-green-gate.yml',
  contents:['permissions:','  contents: write','run: |','  node scripts/ci/repair-lease.mjs acquire','  gh api --method POST repos/x/git/refs/tags/flixo-repair-lease-123'].join('\n'),
  expectedPass:true
});
run({
  workflowName:'unsafe.yml',
  contents:['permissions:','  contents: write','run: |','  gh api --method PATCH repos/x/git/refs/heads/execution -f sha=ABC'].join('\n'),
  expectedPass:false,expectedReason:'WORKFLOW_CONTENTS_WRITE_NOT_ALLOWLISTED'
});
run({
  workflowName:'unsafe-contents.yml',
  contents:['permissions:','  contents: read','run: |','  gh api --method PATCH repos/x/contents/src/a.ts'].join('\n'),
  expectedPass:false,expectedReason:'WORKFLOW_HTTP_GIT_WRITE_NOT_ALLOWLISTED'
});
run({
  workflowName:'unsafe-push.yml',
  contents:['permissions:','  contents: read','run: |','  git push origin execution'].join('\n'),
  expectedPass:false,expectedReason:'WORKFLOW_GIT_PUSH'
});

console.log('NO_DIRECT_PUSH_VALIDATOR_CONTRACT=PASS');
console.log('ALLOWLISTED_EXECUTION_PUBLICATION=PASS');
console.log('ALLOWLISTED_LEASE_CONTROL=PASS');
console.log('UNSAFE_WORKFLOW_REJECTED=PASS');
console.log('GIT_PUSH_REJECTED=PASS');
