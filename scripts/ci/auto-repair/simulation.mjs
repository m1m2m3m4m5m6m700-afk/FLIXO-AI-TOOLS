import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runAstRepair } from './ast-repair.mjs';
import { summarizeDiff } from './evidence.mjs';
import { runVerification } from './verifier.mjs';
import { buildDifferentialProof } from '../differential-repair-proof.mjs';

const git = (cwd, args, options = {}) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    ...options,
  });

function cleanup(targetDir, dir) {
  try {
    git(targetDir, ['worktree', 'remove', '--force', dir], { stdio: 'pipe' });
    return null;
  } catch (error) {
    return String(error?.message ?? error);
  }
}

export function simulateRepair({
  targetDir = process.cwd(),
  plan = null,
  maxChangedFiles = 8,
  maxChangedLines = 300,
  verificationCommands = [],
  targetSha = null,
  failureFingerprint = null,
} = {}) {
  if (!plan?.id || !plan?.file) {
    return Object.freeze({
      ok: false,
      stage: 'preflight',
      reason: 'SIMULATION_PLAN_MISSING',
    });
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-repair-sim-'));
  let added = false;

  try {
    git(targetDir, ['worktree', 'add', '--detach', '--quiet', dir, 'HEAD'], {
      stdio: 'pipe',
    });
    added = true;

    const nm = path.join(targetDir, 'node_modules');
    const simNm = path.join(dir, 'node_modules');
    if (fs.existsSync(nm) && !fs.existsSync(simNm)) {
      fs.symlinkSync(nm, simNm, 'dir');
    }

    const beforeSha = git(dir, ['rev-parse', 'HEAD']);
    const repair = runAstRepair(dir, plan);
    const diff = git(dir, ['diff', '--binary']);
    const summary = summarizeDiff(diff);
    const baseFiles = {};
    const candidateFiles = {};
    for (const file of summary.files) {
      try { baseFiles[file] = git(dir, ['show', `HEAD:${file}`], { stdio: 'pipe' }); } catch { baseFiles[file] = ''; }
      try { candidateFiles[file] = fs.readFileSync(path.join(dir, file), 'utf8'); } catch { candidateFiles[file] = ''; }
    }

    let diffCheck = true;
    try { git(dir, ['diff', '--check'], { stdio: 'pipe' }); } catch { diffCheck = false; }

    const behavioralVerification = verificationCommands.length
      ? runVerification(verificationCommands.map((entry) => Array.isArray(entry) ? entry : [entry.command, entry.args ?? []]))
      : { ok: false, results: [], reason: 'NO_CANDIDATE_VERIFICATION_COMMANDS' };

    const differentialProof = buildDifferentialProof({
      targetSha: targetSha ?? beforeSha,
      failureFingerprint,
      changedPaths: summary.files,
      baseFiles,
      candidateFiles,
      diff,
      protectedPaths: ['scripts/ci/repair-protocol.mjs','scripts/ci/auto-repair-engine.mjs','.github/workflows/auto-repair.yml','scripts/ci/auto-repair/'],
      verification: {
        ok: behavioralVerification.ok,
        diffCheck,
        commands: verificationCommands,
      },
      scopeFiles: plan.files?.length ? plan.files : [plan.file],
    });

    const declaredFiles = Array.isArray(plan.files) && plan.files.length ? plan.files : [plan.file];
    const scopeOk =
      summary.files.length > 0 &&
      summary.files.length <= maxChangedFiles &&
      summary.lines <= maxChangedLines &&
      summary.files.every((file) => declaredFiles.includes(file)) &&
      declaredFiles.includes(plan.file);

    return Object.freeze({
      ok: Boolean(repair?.applied) && scopeOk && behavioralVerification.ok && differentialProof.status === 'PASS',
      stage: 'simulation',
      beforeSha,
      repair,
      diff: summary,
      scopeOk,
      target: plan.file,
      declaredFiles,
      behavioralVerification,
      differentialProof,
      baseFiles,
      candidateFiles,
      candidateDiff: diff,
      isolated: true,
      reason: repair?.applied
        ? !scopeOk
          ? 'SIMULATION_SCOPE_MISMATCH'
          : !behavioralVerification.ok
            ? 'SIMULATION_CANDIDATE_VERIFICATION_FAILED'
            : differentialProof.status !== 'PASS'
              ? 'SIMULATION_DIFFERENTIAL_FAILED'
              : 'SIMULATION_PASS'
        : 'SIMULATION_REPAIR_NOT_APPLIED',
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      stage: 'simulation',
      reason: String(error?.message ?? error),
      isolated: true,
    });
  } finally {
    if (added) {
      const cleanupError = cleanup(targetDir, dir);
      if (cleanupError) {
        process.stderr.write(
          `AUTO_REPAIR_SIMULATION_CLEANUP_FAILED=${cleanupError}\n`,
        );
      }
    } else {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        process.stderr.write(
          `AUTO_REPAIR_SIMULATION_CLEANUP_FAILED=${String(error?.message ?? error)}\n`,
        );
      }
    }
  }
}
