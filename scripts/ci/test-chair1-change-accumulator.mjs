import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureWorkingTreeChange, comparePendingToCurrent, reconcilePendingChange, editReconciledChange, applyReconciliation, finalizeCandidateForChair1 } from './chair1-change-accumulator.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair1-acc-'));
const git=(args,opts={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...opts});
git(['init','--quiet']);
git(['config','user.email','test@example.com']);git(['config','user.name','test']);
fs.mkdirSync(path.join(root,'src'),{recursive:true});
fs.writeFileSync(path.join(root,'src/a.txt'),'line-a\nline-b\n');
git(['add','.']);git(['commit','--quiet','-m','base']);
const base=git(['rev-parse','HEAD']).trim();
fs.writeFileSync(path.join(root,'src/a.txt'),'line-a\nline-b-agent\n');
git(['add','.']);git(['commit','--quiet','-m','candidate']);
const candidate=git(['rev-parse','HEAD']).trim();

const packet=captureWorkingTreeChange({
  repoRoot:root,baseSha:base,executionSha:base,mainSha:base,
  agentId:'AGENT-A',taskId:'TASK-A',summary:'agent change',
});
assert.equal(packet.status,'PENDING_CHAIR1');
assert.equal(packet.changes[0].operation,'UPDATE');
assert.equal(packet.candidateSha,candidate);

const state=comparePendingToCurrent(packet,{currentExecutionSha:candidate,currentMainSha:base});
assert.equal(state.requiresReconciliation,true);
assert.equal(state.state,'STALE_REQUIRES_CHAIR1_REBASE');

const work=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair1-current-'));
execFileSync('git',['clone','--quiet',root,work]);
fs.writeFileSync(path.join(work,'src/a.txt'),'line-a-current\nline-b\n');
const rec=reconcilePendingChange(packet,{repoRoot:work,currentExecutionSha:candidate,currentMainSha:base});
assert.equal(rec.status,'READY_TO_PUBLISH');
assert.equal(rec.files[0].reconciledContent,'line-a-current\nline-b-agent\n');

const conflictWork=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair1-conflict-'));
execFileSync('git',['clone','--quiet',root,conflictWork]);
fs.writeFileSync(path.join(conflictWork,'src/a.txt'),'line-a\nline-b-other\n');
const conflict=reconcilePendingChange(packet,{repoRoot:conflictWork,currentExecutionSha:candidate,currentMainSha:base});
assert.equal(conflict.status,'PENDING_CHAIR1_EDIT');
assert.ok(conflict.conflicts.includes('src/a.txt'));
const edited=editReconciledChange(conflict,{path:'src/a.txt',content:'line-a\nline-b-agent+latest\n'});
assert.equal(edited.status,'READY_TO_PUBLISH');
applyReconciliation(conflictWork,edited);
assert.equal(fs.readFileSync(path.join(conflictWork,'src/a.txt'),'utf8'),'line-a\nline-b-agent+latest\n');

// Chair-1 finalizer: a candidate based on an older execution head is replayed
// onto the current execution head without requiring the proposing agent to resolve the drift.
const finalRoot=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair1-finalize-'));
execFileSync('git',['clone','--quiet',root,finalRoot]);
execFileSync('git',['checkout','--quiet','-b','candidate-lane'],{cwd:finalRoot});
const finalParent=execFileSync('git',['rev-parse','HEAD'],{cwd:finalRoot,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(finalRoot,'src/final.txt'),'candidate\n');
execFileSync('git',['add','.'],{cwd:finalRoot});
execFileSync('git',['commit','--quiet','-m','candidate-final'],{cwd:finalRoot});
const finalCandidate=execFileSync('git',['rev-parse','HEAD'],{cwd:finalRoot,encoding:'utf8'}).trim();

execFileSync('git',['checkout','--quiet','-b','latest-lane',finalParent],{cwd:finalRoot});
fs.writeFileSync(path.join(finalRoot,'src/latest.txt'),'latest\n');
execFileSync('git',['add','.'],{cwd:finalRoot});
execFileSync('git',['commit','--quiet','-m','latest-current'],{cwd:finalRoot});
const latestExecution=execFileSync('git',['rev-parse','HEAD'],{cwd:finalRoot,encoding:'utf8'}).trim();

execFileSync('git',['checkout','--quiet','candidate-lane'],{cwd:finalRoot});
const finalized=finalizeCandidateForChair1({
  repoRoot:finalRoot,
  parentSha:finalParent,
  candidateSha:finalCandidate,
  currentExecutionSha:latestExecution,
  currentMainSha:latestExecution,
  agentId:'CHAIR_1',
  taskId:'FINALIZE-TEST',
});
assert.equal(finalized.status,'READY_TO_PUBLISH');
assert.equal(finalized.reconciled,true);
assert.equal(finalized.parentSha,latestExecution);
assert.notEqual(finalized.candidateSha,finalCandidate);

console.log('CHAIR1_CHANGE_ACCUMULATOR=PASS');
