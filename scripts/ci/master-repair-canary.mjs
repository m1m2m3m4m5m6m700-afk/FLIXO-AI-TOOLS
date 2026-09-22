#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const candidateSha = String(process.env.FLIXO_CANDIDATE_SHA ?? '').trim();
const parentSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? '').trim();
const output = process.env.FLIXO_CANARY_PROOF_PATH ?? '/tmp/flixo-canary-proof.json';
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!/^[a-f0-9]{40}$/u.test(candidateSha) || !/^[a-f0-9]{40}$/u.test(parentSha)) throw new Error('CANARY_SHA_INVALID');
if (git(root, ['rev-parse', 'HEAD']) !== candidateSha) throw new Error('CANARY_CANDIDATE_NOT_HEAD');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-master-canary-'));
const worktree = path.join(temp, 'repo');
let attached = false;
const checks = [];
try {
  git(root, ['worktree', 'add', '--detach', worktree, candidateSha]);
  attached = true;
  if (git(worktree, ['rev-parse', 'HEAD']) !== candidateSha) throw new Error('CANARY_WORKTREE_SHA_MISMATCH');
  const changed = git(root, ['diff', '--name-only', parentSha, candidateSha]).split(/\r?\n/u).filter(Boolean);
  const jsFiles = changed.filter((file) => /\.(mjs|cjs|js)$/u.test(file)).slice(0, 12);
  for (const file of jsFiles) {
    try {
      execFileSync('node', ['--check', file], { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'] });
      checks.push({ command: 'node --check ' + file, status: 'PASS' });
    } catch {
      checks.push({ command: 'node --check ' + file, status: 'FAIL' });
    }
  }
  try {
    execFileSync('git', ['diff', '--check', parentSha, candidateSha], { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'] });
    checks.push({ command: 'git diff --check', status: 'PASS' });
  } catch {
    checks.push({ command: 'git diff --check', status: 'FAIL' });
  }
} finally {
  if (attached) {
    try { git(root, ['worktree', 'remove', '--force', worktree]); } catch { /* cleanup failure is non-authoritative */ }
  }
  try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* cleanup failure is non-authoritative */ }
}

const status = checks.every((x) => x.status === 'PASS') ? 'PASS' : 'FAIL';
const receipt = {
  schemaVersion: 1,
  protocol: 'FLIXO-PRE-PUBLICATION-CANARY-v1',
  authority: 'ISOLATED_REBUILD',
  targetSha: candidateSha,
  parentSha,
  isolatedWorktree: true,
  independentCheckout: true,
  checks,
  status,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (status !== 'PASS') process.exitCode = 2;
