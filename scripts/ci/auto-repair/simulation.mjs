import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runAstRepair } from './ast-repair.mjs';
import { summarizeDiff } from './evidence.mjs';

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

    git(dir, ['diff', '--check'], { stdio: 'pipe' });

    const scopeOk =
      summary.files.length > 0 &&
      summary.files.length <= maxChangedFiles &&
      summary.lines <= maxChangedLines &&
      summary.files.includes(plan.file);

    return Object.freeze({
      ok: Boolean(repair?.applied) && scopeOk,
      stage: 'simulation',
      beforeSha,
      repair,
      diff: summary,
      scopeOk,
      target: plan.file,
      isolated: true,
      reason: repair?.applied
        ? scopeOk
          ? 'SIMULATION_PASS'
          : 'SIMULATION_SCOPE_MISMATCH'
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
