#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-guard-communication-'));
const originalCwd = process.cwd();
process.chdir(temp);
execFileSync('git', ['init'], { stdio: 'ignore' });
execFileSync('git', ['config','user.email','guard@test.local']);
execFileSync('git', ['config','user.name','Guard Test']);
fs.writeFileSync('README.md','guard\n');
execFileSync('git',['add','.']);
execFileSync('git',['commit','-m','base'],{stdio:'ignore'});
const entrySha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync('README.md','guard\nchange\n');
execFileSync('git',['add','.']);
execFileSync('git',['commit','-m','change'],{stdio:'ignore'});
const executionShaAtEntry = entrySha;
const mainShaAtEntry = entrySha;
const workspaceSha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const mod = await import(new URL('./guard-communication.mjs', import.meta.url));

const sent = mod.reportAgentChange({
  agentId:'CELL-001',
  taskId:'GUARD-COMM-TEST',
  entrySha,
  executionShaAtEntry,
  mainShaAtEntry,
  currentWorkspaceSha:workspaceSha,
  changedFiles:['README.md'],
  changeDetails:['UPDATE README.md'],
  patchSha256:'a'.repeat(64),
  candidateSha:workspaceSha,
  resultId:'result-001',
  resultStatus:'READY_FOR_CHAIR1',
  risk:'HIGH',
  summary:'test change',
  evidence:['DIFF_CHECK_PASS'],
  remainingWork:['chair1-reconciliation'],
  blockers:[],
  nextActions:['chair1-review'],
  source:'TEST'
});
assert.equal(sent.status,'RECEIVED');
assert.equal(sent.recipient,'CHAIR_1_GUARD');
assert.equal(sent.editableBy,'CHAIR_1');

const listed = mod.listChangeReports({status:'RECEIVED',taskId:'GUARD-COMM-TEST'});
assert.equal(listed.length,1);
const read = mod.markRead(sent.reportId,'CHAIR_1_GUARD');
assert.equal(read.status,'READ');
const forwarded = mod.decideChangeReport(sent.reportId,{
  guardAgent:'CHAIR_1_GUARD',
  decision:'FORWARDED_TO_CHAIR1',
  reason:'Receipt complete; final filtering belongs to Chair 1',
  currentExecutionSha:workspaceSha
});
assert.equal(forwarded.status,'FORWARDED_TO_CHAIR1');
assert.equal(forwarded.guardVerdict.contentDecision,'NONE');
assert.equal(forwarded.guardVerdict.rejectionAuthority,false);
assert.equal(forwarded.guardVerdict.deletionAuthority,false);
assert.throws(
  ()=>mod.decideChangeReport(sent.reportId,{guardAgent:'CHAIR_1_GUARD',decision:'REJECTED',reason:'x',currentExecutionSha:workspaceSha}),
  /GUARD_CHANGE_REJECTION_FORBIDDEN/
);
assert.throws(
  ()=>mod.createChangeReport({
    agentId:'CELL-001',taskId:'GUARD-COMM-TEST',entrySha:'bad',executionShaAtEntry:entrySha,mainShaAtEntry:mainShaAtEntry,
    changedFiles:['README.md'],changeDetails:['UPDATE'],risk:'HIGH'
  }),
  /GUARD_CHANGE_ENTRY_SHA_INVALID/
);

process.chdir(originalCwd);
console.log('GUARD_CHANGE_COMMUNICATION=PASS');
console.log('GUARD_CHANGE_READ_ACK=PASS');
console.log('GUARD_CHANGE_FORWARD_ONLY=PASS');
console.log('GUARD_CHANGE_NO_GREEN=PASS');
console.log('GUARD_CHANGE_EXACT_SHA=PASS');
