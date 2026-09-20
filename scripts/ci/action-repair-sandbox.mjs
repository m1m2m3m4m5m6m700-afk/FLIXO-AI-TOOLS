#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validatePatchOperation, applyPatchOperations } from './action-patch-synthesis.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { verifyDifferential } from './action-differential-verifier.mjs';

const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const run = (cwd, file, args, timeout = 120_000) => execFileSync(file, args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout,
  maxBuffer: 24 * 1024 * 1024,
});

const parseCheck = (check) => {
  const value = String(check).trim();
  if (value === 'npm run typecheck') return ['npm', ['run', 'typecheck']];
  if (value === 'npm run lint') return ['npm', ['run', 'lint']];
  if (value === 'npm run build') return ['npm', ['run', 'build']];
  if (/^npm run test:[A-Za-z0-9:_-]+$/u.test(value)) return ['npm', ['run', value.slice('npm run '.length)]];
  if (/^node (?:--(?:import|require)=\S+ )?(?:scripts|diagnostics)\//u.test(value)) {
    const parts = value.split(/\s+/u);
    return ['node', parts.slice(1)];
  }
  if (/^node --check (?:scripts|diagnostics)\//u.test(value)) {
    const parts = value.split(/\s+/u);
    return ['node', parts.slice(1)];
  }
  throw new Error(`SANDBOX_CHECK_NOT_ALLOWLISTED:${value}`);
};

const runGit = (cwd, args) => run(cwd, 'git', args, 60_000);

export function assertCleanRepository(repoRoot) {
  const status = runGit(repoRoot, ['status', '--porcelain']);
  if (status.trim()) throw new Error('SANDBOX_REQUIRES_CLEAN_REPOSITORY');
}

export function applyOperationsToWorktree(worktree, operations) {
  for (const operation of operations) validatePatchOperation(operation);
  const sourceByPath = new Map();
  for (const operation of operations) {
    const file = path.resolve(worktree, operation.path);
    if (!sourceByPath.has(operation.path)) {
      if (!fs.existsSync(file)) throw new Error(`SANDBOX_FILE_MISSING:${operation.path}`);
      sourceByPath.set(operation.path, fs.readFileSync(file, 'utf8'));
    }
  }
  const { output, receipts } = applyPatchOperations(sourceByPath, operations);
  for (const [file, content] of output.entries()) {
    fs.writeFileSync(path.resolve(worktree, file), content);
  }
  return receipts;
}

export function runSandboxChecks(worktree, checks) {
  const results = [];
  for (const check of [...new Set(checks)]) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const [file, args] = parseCheck(check);
    try {
      const stdout = run(worktree, file, args, 300_000);
      const finishedAt = new Date().toISOString();
      results.push({
        check,
        status: 'PASS',
        exitCode: 0,
        durationMs: Date.now() - startedMs,
        startedAt,
        finishedAt,
        stdout: stdout.slice(-8000),
        stderr: '',
        stdoutDigest: sha256(stdout),
        stderrDigest: sha256(''),
      });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const stdout = String(error?.stdout ?? '').slice(-8000);
      const stderr = String(error?.stderr ?? error?.message ?? error).slice(-8000);
      results.push({
        check,
        status: 'FAIL',
        exitCode: Number(error?.status ?? 1),
        durationMs: Date.now() - startedMs,
        startedAt,
        finishedAt,
        stdout,
        stderr,
        stdoutDigest: sha256(stdout),
        stderrDigest: sha256(stderr),
      });
      break;
    }
  }
  return results;
}

export function simulateRepair({
  repoRoot = process.cwd(),
  taskId,
  fingerprint,
  targetSha,
  candidate,
  checks = candidate?.predictedChecks ?? ['node --check scripts/ci/action-patch-synthesis.mjs'],
  baselineStatus = 'UNKNOWN',
} = {}) {
  if (!taskId || !fingerprint || !exactSha(targetSha)) throw new Error('SANDBOX_IDENTITY_REQUIRED');
  if (!candidate?.operations?.length) throw new Error('SANDBOX_CANDIDATE_OPERATIONS_REQUIRED');
  assertCleanRepository(repoRoot);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-action-repair-'));
  let worktree = path.join(tempRoot, 'repo');
  let added = false;
  try {
    runGit(repoRoot, ['worktree', 'add', '--detach', worktree, targetSha]);
    added = true;
    const nodeModules = path.join(repoRoot, 'node_modules');
    const sandboxNodeModules = path.join(worktree, 'node_modules');
    if (fs.existsSync(nodeModules) && !fs.existsSync(sandboxNodeModules)) {
      try { fs.symlinkSync(nodeModules, sandboxNodeModules, 'junction'); } catch { /* dependency link is optional */ }
    }
    const head = runGit(worktree, ['rev-parse', 'HEAD']).trim();
    if (head !== targetSha) throw new Error('SANDBOX_TARGET_SHA_MISMATCH');

    const receipts = applyOperationsToWorktree(worktree, candidate.operations);
    const before = runGit(worktree, ['diff', '--name-only', targetSha]).trim();
    if (!before) throw new Error('SANDBOX_PATCH_PRODUCED_NO_GIT_DIFF');

    const results = runSandboxChecks(worktree, checks);
    const failed = results.find((item) => item.status === 'FAIL');
    const differential = verifyDifferential({
      repoRoot: worktree,
      targetSha,
      candidateId: candidate.id,
      operationPaths: candidate.operations.map((operation) => operation.path),
      candidateChecks: results.map((item) => item.check),
      candidateCheckResults: results,
      expectedChecks: checks,
      baselineStatus,
      requireExecutionEvidence: true,
    });
    return {
      schemaVersion: 1,
      protocol: 'REPAIR_SANDBOX_SIMULATION_V1',
      status: failed || differential.status !== 'PASS' ? 'FAIL' : 'PASS',
      identity: { taskId, failureFingerprint: fingerprint, targetSha },
      candidate: { id: candidate.id, strategy: candidate.strategy, confidence: candidate.confidence },
      receipts,
      checks: results,
      differential,
      mutationPerformed: false,
      sourceWorktree: worktree,
      patchDigest: sha256(runGit(worktree, ['diff', '--binary'])),
      changedFiles: runGit(worktree, ['diff', '--name-only', targetSha]).split(/\\r?\\n/u).filter(Boolean),
      canonicalGreenRequired: true,
      patchCorrectnessProof: {
        status: failed || differential.status !== 'PASS' ? 'UNPROVEN' : 'PROVEN',
        targetSha,
        exactShaBound: true,
        mutationPerformed: false,
        differentialStatus: differential.status,
        executedChecks: results,
      },
    };
  } finally {
    if (added) {
      try { runGit(repoRoot, ['worktree', 'remove', '--force', worktree]); } catch { /* cleanup is best effort */ }
    }
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* temp cleanup is best effort */ }
  }
}


export function simulateAstRepair({
  repoRoot = process.cwd(),
  taskId,
  fingerprint,
  targetSha,
  selected,
  checks = [],
} = {}) {
  if (!taskId || !fingerprint || !exactSha(targetSha)) throw new Error('SANDBOX_AST_IDENTITY_REQUIRED');
  if (!selected || typeof selected !== 'object') throw new Error('SANDBOX_AST_SELECTION_REQUIRED');
  if (!Array.isArray(checks) || checks.length === 0) throw new Error('SANDBOX_AST_CHECKS_REQUIRED');
  assertCleanRepository(repoRoot);
  const allowedPaths = [...new Set((selected.files?.length ? selected.files : [selected.file]).map(String).filter(Boolean))];
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-action-ast-repair-'));
  const worktree = path.join(tempRoot, 'repo');
  let added = false;
  try {
    runGit(repoRoot, ['worktree', 'add', '--detach', worktree, targetSha]);
    added = true;
    const head = runGit(worktree, ['rev-parse', 'HEAD']).trim();
    if (head !== targetSha) throw new Error('SANDBOX_AST_TARGET_SHA_MISMATCH');
    runAstRepair(worktree, selected);
    const diff = runGit(worktree, ['diff', '--binary']);
    const changedFiles = runGit(worktree, ['diff', '--name-only', targetSha]).split(/\\r?\\n/u).filter(Boolean);
    if (!diff || !changedFiles.length) throw new Error('SANDBOX_AST_PATCH_EMPTY');
    const unexpected = changedFiles.filter((file) => !allowedPaths.includes(file));
    if (unexpected.length) throw new Error('SANDBOX_AST_SCOPE_EXCEEDED=' + unexpected.join(','));
    const results = runSandboxChecks(worktree, checks);
    const differential = verifyDifferential({
      repoRoot: worktree,
      targetSha,
      candidateId: String(selected.id ?? 'AST_REPAIR'),
      operationPaths: allowedPaths,
      candidateChecks: results.map((item) => item.check),
      candidateCheckResults: results,
      expectedChecks: checks,
      baselineStatus: 'PASS',
      requireExecutionEvidence: true,
    });
    const failed = results.find((item) => item.status !== 'PASS' || Number(item.exitCode ?? 1) !== 0);
    const patchDigest = sha256(diff);
    return {
      schemaVersion: 2,
      protocol: 'REPAIR_SANDBOX_SIMULATION_V1',
      status: failed || differential.status !== 'PASS' ? 'FAIL' : 'PASS',
      taskId,
      failureFingerprint: fingerprint,
      targetSha,
      exactShaBound: true,
      mutationPerformed: false,
      candidate: { id: selected.id ?? null, strategy: selected.strategy ?? selected.id ?? null },
      changedFiles,
      unexpectedFiles: unexpected,
      patchDigest,
      checks: results,
      differential,
      patchCorrectnessProof: {
        status: failed || differential.status !== 'PASS' ? 'UNPROVEN' : 'PROVEN',
        targetSha,
        patchDigest,
        differentialStatus: differential.status,
        executionEvidence: results,
        mutationPerformed: false,
      },
    };
  } finally {
    if (added) {
      try { runGit(repoRoot, ['worktree', 'remove', '--force', worktree]); } catch { /* cleanup is best effort */ }
    }
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* cleanup is best effort */ }
  }
}
