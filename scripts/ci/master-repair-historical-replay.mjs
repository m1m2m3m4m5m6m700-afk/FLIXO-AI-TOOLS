#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const targetSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? '').trim();
const candidateSha = String(process.env.FLIXO_CANDIDATE_SHA ?? '').trim();
const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const output = process.env.FLIXO_HISTORICAL_REPLAY_PATH ?? '/tmp/flixo-historical-replay.json';
const fp = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim();
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!/^[a-f0-9]{40}$/u.test(targetSha) || !/^[a-f0-9]{40}$/u.test(candidateSha)) throw new Error('HISTORICAL_REPLAY_SHA_INVALID');
if (!fs.existsSync(memoryPath)) throw new Error('HISTORICAL_REPLAY_MEMORY_MISSING');

const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
const cases = [...(memory.cases ?? []), ...(memory.playbooks ?? []), ...(memory.actionHistory ?? [])]
  .filter((item) => item && (item.failedSha || item.targetSha))
  .filter((item) => !fp || String(item.fingerprint ?? '') !== fp)
  .slice(-25);

const candidateDiff = git(root, ['diff', '--binary', targetSha, candidateSha]);
const rootCause = String((memory.cases ?? []).find((item) => item.fingerprint === fp)?.rootCause ?? '').toLowerCase();
const similar = cases.filter((item) => {
  if (!rootCause) return true;
  return String(item.rootCause ?? '').toLowerCase() === rootCause;
}).slice(-3);

const results = [];
for (const item of similar) {
  const historicalSha = String(item.targetSha ?? item.failedSha ?? '').trim();
  if (!/^[a-f0-9]{40}$/u.test(historicalSha)) continue;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-historical-replay-'));
  const worktree = path.join(temp, 'repo');
  let attached = false;
  try {
    git(root, ['worktree', 'add', '--detach', worktree, historicalSha]);
    attached = true;
    const patchFile = path.join(temp, 'candidate.patch');
    fs.writeFileSync(patchFile, candidateDiff);
    let applied = true;
    try {
      execFileSync('git', ['apply', '--check', patchFile], { cwd: worktree, encoding: 'utf8' });
      execFileSync('git', ['apply', patchFile], { cwd: worktree, encoding: 'utf8' });
    } catch {
      applied = false;
    }
    if (!applied) {
      results.push({ historicalSha, status: 'PATCH_NOT_APPLICABLE', caseFingerprint: item.fingerprint ?? null });
      continue;
    }
    const changed = git(worktree, ['diff', '--name-only', historicalSha]).split(/\r?\n/u).filter(Boolean);
    const syntaxFiles = changed.filter((file) => /\.(mjs|cjs|js)$/u.test(file)).slice(0, 5);
    let checksPassed = true;
    for (const file of syntaxFiles) {
      try {
        execFileSync('node', ['--check', file], { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        checksPassed = false;
        break;
      }
    }
    results.push({
      historicalSha,
      status: checksPassed ? 'REPLAY_PASS' : 'REPLAY_FAIL',
      caseFingerprint: item.fingerprint ?? null,
      changedFiles: changed,
    });
  } finally {
    if (attached) {
      try { git(root, ['worktree', 'remove', '--force', worktree]); } catch {}
    }
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch {}
  }
}

const replayPassed = results.filter((x) => x.status === 'REPLAY_PASS').length;
const receipt = {
  schemaVersion: 1,
  protocol: 'FLIXO-HISTORICAL-PATCH-REPLAY-v1',
  authority: 'READ_ONLY_REPLAY',
  targetSha,
  candidateSha,
  failureFingerprint: fp,
  attemptedCases: results.length,
  replayPassed,
  replayFailed: results.filter((x) => x.status === 'REPLAY_FAIL').length,
  notApplicable: results.filter((x) => x.status === 'PATCH_NOT_APPLICABLE').length,
  results,
  status: results.length === 0 ? 'NOT_APPLICABLE' : (replayPassed > 0 ? 'PASS' : 'FAIL'),
  promotionRule: 'HISTORICAL_REPLAY_IS_SUPPORTING_EVIDENCE_NOT_CANONICAL_GREEN',
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (receipt.status === 'FAIL') process.exitCode = 2;
