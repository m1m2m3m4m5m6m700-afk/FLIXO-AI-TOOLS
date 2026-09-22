#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
const pending = mod.acknowledgePendingPush(sent.reportId,'CHAIR_1_GUARD');
assert.equal(pending.status,'PUSH_PENDING');
assert.equal(pending.pendingPush,true);
assert.equal(pending.changeDetailsPresent,true);
assert.equal(pending.guardRole,'PUSH_PENDING_ACK_ONLY');
assert.equal(pending.guardVerdict.contentDecision,'NONE');
assert.equal(pending.guardVerdict.rejectionAuthority,false);
assert.equal(pending.guardVerdict.deletionAuthority,false);
assert.equal(pending.guardVerdict.mergeAuthority,false);
assert.equal(pending.guardVerdict.publicationAuthority,'CHAIR_1');

assert.equal(typeof mod.requestFullDetails,'undefined');
assert.equal(typeof mod.recordFullDetails,'undefined');
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
console.log('GUARD_CHANGE_PENDING_PUSH_ACK_ONLY=PASS');
console.log('GUARD_CHANGE_NO_GREEN=PASS');
console.log('GUARD_CHANGE_EXACT_SHA=PASS');
