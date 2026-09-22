#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const candidateSha = String(process.env.FLIXO_CANDIDATE_SHA ?? '').trim();
const parentSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? '').trim();
const knownGoodSha = String(process.env.FLIXO_KNOWN_GOOD_SHA ?? '').trim();
const output = process.env.FLIXO_ROLLBACK_PROOF_PATH ?? '/tmp/flixo-rollback-proof.json';
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!/^[a-f0-9]{40}$/u.test(candidateSha) || !/^[a-f0-9]{40}$/u.test(parentSha)) throw new Error('ROLLBACK_SHA_INVALID');
if (!/^[a-f0-9]{40}$/u.test(knownGoodSha)) {
  const receipt = {
    schemaVersion: 1,
    protocol: 'FLIXO-ROLLBACK-PROOF-v1',
    authority: 'READ_ONLY_ROLLBACK_PROVER',
    candidateSha,
    parentSha,
    knownGoodSha: null,
    status: 'UNPROVEN',
    reason: 'KNOWN_GOOD_SHA_ATTESTATION_MISSING',
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
  process.exitCode = 2;
} else {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-rollback-proof-'));
  const worktree = path.join(temp, 'repo');
  let attached = false;
  let mechanicallyReversible;
  try {
    git(root, ['worktree', 'add', '--detach', worktree, candidateSha]);
    attached = true;
    git(worktree, ['revert', '--no-edit', candidateSha]);
    mechanicallyReversible = git(worktree, ['rev-parse', 'HEAD']) !== candidateSha;
  } catch {
    mechanicallyReversible = false;
  } finally {
    if (attached) { try { git(root, ['worktree', 'remove', '--force', worktree]); } catch { /* best-effort cleanup or reachability probe */ } }
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* best-effort cleanup or reachability probe */ }
  }
  let knownGoodReachable = false;
  try {
    execFileSync('git', ['cat-file', '-e', knownGoodSha + '^{commit}'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    knownGoodReachable = true;
  } catch { /* best-effort cleanup or reachability probe */ }
  const status = mechanicallyReversible && knownGoodReachable ? 'PROVEN' : 'UNPROVEN';
  const receipt = {
    schemaVersion: 1,
    protocol: 'FLIXO-ROLLBACK-PROOF-v1',
    authority: 'READ_ONLY_ROLLBACK_PROVER',
    candidateSha,
    parentSha,
    knownGoodSha,
    mechanicallyReversible,
    knownGoodReachable,
    status,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  if (status !== 'PROVEN') process.exitCode = 2;
}
