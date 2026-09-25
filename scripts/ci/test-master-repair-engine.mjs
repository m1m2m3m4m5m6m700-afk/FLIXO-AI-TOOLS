#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  MASTER_REPAIR_ENGINE_PROTOCOL,
  assertExactExecutionHead,
  readRepositoryFile,
  buildRepositoryGraph,
  buildNoRepairDecision,
  applyWriteTransaction,
} from './master-repair-engine.mjs';

const repoRoot=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-master-repair-engine-test-'));
const git=args=>execFileSync('git',args,{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const put=(file,content)=>{
  const abs=path.join(repoRoot,file);
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,content);
};

try {
  git(['init','-b','execution']);
  git(['config','user.email','master-repair@test.invalid']);
  git(['config','user.name','MASTER_REPAIR_TEST']);
  put('src/demo.mjs','export const value = 1;\n');
  put('src/consumer.mjs',"import { value } from './demo.mjs';\nconsole.log(value);\n");
  git(['add','.']);
  git(['commit','-m','fixture']);
  const sha=git(['rev-parse','HEAD']);

  assert.equal(MASTER_REPAIR_ENGINE_PROTOCOL,'FLIXO-MASTER-REPAIR-ENGINE-v2');
  assert.doesNotThrow(()=>assertExactExecutionHead(repoRoot,sha));
  assert.equal(readRepositoryFile({repoRoot,targetSha:sha,file:'src/demo.mjs'}).content.trim(),'export const value = 1;');

  const graph=buildRepositoryGraph({repoRoot,targetSha:sha});
  assert.ok(graph.edgeCount>=1);
  assert.ok(graph.nodes.find(x=>x.path==='src/demo.mjs')?.importedBy.includes('src/consumer.mjs'));

  const decision=buildNoRepairDecision({
    targetSha:sha,currentSha:sha,taskId:'TASK-1',fingerprint:'a'.repeat(64),runId:'RUN-1',
    evidence:{currentFailureLog:true},failureText:'rate limit from provider'
  });
  assert.equal(decision.decision,'NO_REPAIR');
  assert.ok(decision.reasons.includes('EXTERNAL_PROVIDER_BLOCKER'));

  const plan={
    taskId:'TASK-1',fingerprint:'a'.repeat(64),runId:'RUN-1',targetSha:sha,
    evidence:{currentFailureLog:true},admission:{chair1:true,independentVerification:true},allowedPaths:['src/demo.mjs'],
    writes:[{path:'src/demo.mjs',kind:'replace',search:'value = 1',replace:'value = 2'}],
    checks:['node --check src/demo.mjs']
  };
  const receipt=applyWriteTransaction({repoRoot,plan});
  assert.equal(receipt.status,'WRITTEN_PENDING_CANONICAL_GREEN');
  assert.match(fs.readFileSync(path.join(repoRoot,'src/demo.mjs'),'utf8'),/value = 2/u);
  git(['checkout','--','src/demo.mjs']);

  const bad={...plan,writes:[{path:'src/demo.mjs',kind:'replace',search:'value = 1',replace:'value = {'}]};
  assert.throws(()=>applyWriteTransaction({repoRoot,plan:bad}));
  assert.match(fs.readFileSync(path.join(repoRoot,'src/demo.mjs'),'utf8'),/value = 2/u);

  const forbidden={...plan,allowedPaths:['scripts/ci/control-plane-registry.mjs'],writes:[{path:'scripts/ci/control-plane-registry.mjs',kind:'write',content:'bad'}]};
  assert.throws(()=>applyWriteTransaction({repoRoot,plan:forbidden}));

  console.log('MASTER_REPAIR_ENGINE_TEST=PASS');
} finally {
  fs.rmSync(repoRoot,{recursive:true,force:true});
}
