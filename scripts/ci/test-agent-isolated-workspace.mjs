import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readCanonicalSnapshot, createAgentWorkspace, assertWorkspaceIsolation, captureAgentResult, cleanupAgentWorkspace } from './agent-isolated-workspace.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-agent-root-'));
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
git(['init','--quiet']);git(['config','user.email','test@example.com']);git(['config','user.name','test']);
fs.writeFileSync(path.join(root,'file.txt'),'base\n');git(['add','.']);git(['commit','--quiet','-m','base']);
git(['branch','-M','execution']);git(['branch','main']);
const snapshot=readCanonicalSnapshot(root);
assert.match(snapshot.executionSha,/^[a-f0-9]{40}$/);assert.equal(snapshot.executionSha,snapshot.mainSha);
const workspace=createAgentWorkspace({
  repoRoot:root,agentId:'AGENT-A',taskId:'TASK-A',
  baseSha:snapshot.executionSha,executionSha:snapshot.executionSha,mainSha:snapshot.mainSha,
  workspaceRoot:fs.mkdtempSync(path.join(os.tmpdir(),'flixo-ws-')),
});
assert.equal(workspace.tracksBranchHead,false);
assert.equal(workspace.detached,true);
assert.deepEqual(assertWorkspaceIsolation({repoRoot:root,workspace:workspace.workspace,entrySha:snapshot.executionSha}).isolated,true);
fs.writeFileSync(path.join(workspace.workspace,'file.txt'),'agent-change\n');
const result=captureAgentResult({
  repoRoot:root,workspace:workspace.workspace,agentId:'AGENT-A',taskId:'TASK-A',
  entrySha:snapshot.executionSha,executionSha:snapshot.executionSha,mainSha:snapshot.mainSha,
});
assert.equal(result.editableBy,'CHAIR_1');
assert.equal(result.agentPublicationAllowed,false);
assert.deepEqual(result.changedFiles,['file.txt']);
assert.match(result.patch,/agent-change/);
git(['checkout','--quiet','execution']);
fs.writeFileSync(path.join(root,'file.txt'),'latest-mainline-change\n');
git(['add','.']);git(['commit','--quiet','-m','latest']);
const newer=git(['rev-parse','HEAD']);
assert.throws(()=>assertWorkspaceIsolation({repoRoot:root,workspace:workspace.workspace,entrySha:newer}),/ENTRY_SHA_DRIFT/);
cleanupAgentWorkspace({repoRoot:root,workspace:workspace.workspace,force:true});
console.log('AGENT_ISOLATED_WORKSPACE=PASS');
