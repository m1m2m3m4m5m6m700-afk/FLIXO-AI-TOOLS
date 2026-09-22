#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const auditScript = path.join(repoRoot, 'scripts/ci/auto-repair-chair1-audit.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-chair1-audit-'));
const run = (args) => execFileSync('git', args, { cwd: temp, encoding: 'utf8' }).trim();
const node = (args, extra={}) => spawnSync(process.execPath, [auditScript, ...args], { cwd: temp, encoding: 'utf8', ...extra });

run(['init', '-q']);
run(['config', 'user.email', 'test@example.invalid']);
run(['config', 'user.name', 'FLIXO Chair1 Test']);
fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
fs.writeFileSync(path.join(temp, 'src/example.ts'), 'export const ok = true;\n');
run(['add', '.']);
run(['commit', '-q', '-m', 'baseline']);
const parentSha = run(['rev-parse', 'HEAD']);
fs.writeFileSync(path.join(temp, 'src/example.ts'), 'export const ok = false;\n');
run(['add', '.']);
run(['commit', '-q', '-m', 'fix(auto-repair): verified source repair']);
const candidateSha = run(['rev-parse', 'HEAD']);

const evidencePath = path.join(temp, 'evidence.json');
const verificationPath = path.join(temp, 'verification.json');
const adversarialPath = path.join(temp, 'adversarial.json');
const proposalPath = path.join(temp, 'proposal.json');
const auditPath = path.join(temp, 'audit.json');
const lessonPath = path.join(temp, 'lesson.json');

fs.writeFileSync(evidencePath, JSON.stringify({
  protocol: 'AUTONOMOUS-REPAIR-PROTOCOL-v4',
  targetSha: parentSha,
  outcome: 'verified-repair',
  fingerprint: 'a'.repeat(64),
  selected: 'prepared-source-change',
  changedPaths: ['src/example.ts']
}));
fs.writeFileSync(verificationPath, JSON.stringify({
  mode: 'PARALLEL',
  earlyAbort: false,
  gate: { result: 'PASS', targetedRegression: true, adversarialNoCounterexample: true }
}));
fs.writeFileSync(adversarialPath, JSON.stringify({
  falsifierVerdict: 'PASS_NO_COUNTEREXAMPLE',
  passConfirmed: true
}));

const approved = node([
  '--actor=AUTO_REPAIR_BOT',
  '--required-reviewer=chair_1',
  '--candidate='+candidateSha,
  '--parent='+parentSha,
  '--evidence='+evidencePath,
  '--verification='+verificationPath,
  '--adversarial='+adversarialPath,
  '--proposal='+proposalPath,
  '--output='+auditPath,
  '--lesson-output='+lessonPath,
]);
assert.equal(approved.status, 0, approved.stderr || approved.stdout);
const approvedAudit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
assert.equal(approvedAudit.decision, 'APPROVED');
assert.equal(approvedAudit.proposerAgent, 'AUTO_REPAIR_BOT');
assert.equal(approvedAudit.chairId, 'chair_1');
assert.equal(approvedAudit.reviewerAgent, 'CHAIR_1_AUDITOR');

const rejectedSelf = node([
  '--actor=EVIL_REPAIR_BOT',
  '--required-reviewer=chair_1',
  '--candidate='+candidateSha,
  '--parent='+parentSha,
  '--evidence='+evidencePath,
  '--verification='+verificationPath,
  '--adversarial='+adversarialPath,
  '--proposal='+path.join(temp, 'proposal-self.json'),
  '--output='+path.join(temp, 'audit-self.json'),
  '--lesson-output='+path.join(temp, 'lesson-self.json'),
]);
assert.notEqual(rejectedSelf.status, 0);
const selfAudit = JSON.parse(fs.readFileSync(path.join(temp, 'audit-self.json'), 'utf8'));
assert.equal(selfAudit.decision, 'REJECTED');
assert.ok(selfAudit.reasonCodes.includes('REPAIR_ACTOR_IDENTITY_INVALID'));

console.log('AUTO_REPAIR_CHAIR1_AUDIT_APPROVED_CASE=PASS');
console.log('AUTO_REPAIR_CHAIR1_SELF_IDENTITY_REJECTION=PASS');
