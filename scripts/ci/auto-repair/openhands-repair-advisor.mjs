import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const SHA_RE = /^[a-f0-9]{40}$/u;

function git(targetDir, args) {
  return execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8' }).trim();
}

export function buildOpenHandsAdvisorPrompt({ targetSha, failureFingerprint, diagnosis, failureLog }) {
  return [
    'You are the OpenHands repair advisor inside FLIXO.',
    'Your role is advisory repair engineering only.',
    '',
    'HARD BOUNDARIES:',
    '- Work only in this detached temporary workspace.',
    '- Never create or switch branches.',
    '- Never commit, push, merge, mutate refs, or access main.',
    '- Never change tests, CI workflows, security controls, certification gates, or control-plane files.',
    '- Never add dependencies or redesign architecture.',
    '- Diagnose the exact current failure and propose the smallest source-only repair.',
    '- You may run targeted diagnostics/tests in the detached workspace.',
    '- Do not claim GREEN, certification, or successful publication.',
    '- The FLIXO repair engine remains the only mutation/commit authority.',
    '',
    'EXACT IDENTITY:',
    JSON.stringify({
      targetSha,
      failureFingerprint,
      diagnosisSha: diagnosis?.targetSha ?? null,
      failureLogSha256: createHash('sha256').update(String(failureLog ?? ''), 'utf8').digest('hex'),
    }),
    '',
    'CURRENT DIAGNOSIS:',
    JSON.stringify(diagnosis ?? null, null, 2).slice(0, 16000),
    '',
    'TASK:',
    '1. Reproduce or inspect the failure.',
    '2. Identify the most likely causal source file and invariant violation.',
    '3. Apply the minimal candidate source patch in this detached workspace.',
    '4. Run the narrowest useful verification.',
    '5. Stop and leave the candidate patch uncommitted.',
    '6. Do not edit tests or infrastructure merely to make the failure disappear.',
  ].join('\n');
}

export function runOpenHandsRepairAdvisor({
  targetDir = process.cwd(),
  targetSha,
  failureFingerprint,
  failureLog = '',
  diagnosis = null,
} = {}) {
  const precomputedPath = process.env.FLIXO_OPENHANDS_PRIORITY_PATH ?? '';
  if (precomputedPath && fs.existsSync(precomputedPath)) {
    try {
      const precomputed = JSON.parse(fs.readFileSync(precomputedPath, 'utf8'));
      if (precomputed?.targetSha === targetSha && precomputed?.protocol === 'FLIXO-OPENHANDS-REPAIR-ADVISOR-v1') {
        return Object.freeze({ ...precomputed, reusedPrecomputed: true });
      }
    } catch {
      // Invalid precomputed evidence is ignored; the exact-SHA adapter will re-run and fail closed if unavailable.
    }
  }
  const enabled = process.env.FLIXO_OPENHANDS_ADVISOR_ENABLED === 'true';
  if (!enabled) {
    return Object.freeze({
      status: 'DISABLED',
      protocol: 'FLIXO-OPENHANDS-REPAIR-ADVISOR-v1',
      targetSha: targetSha ?? null,
      mutationAuthority: 'NONE',
    });
  }

  const currentSha = git(targetDir, ['rev-parse', 'HEAD']);
  const branch = git(targetDir, ['branch', '--show-current']);
  if (!SHA_RE.test(String(targetSha ?? '')) || currentSha !== targetSha) {
    return Object.freeze({ status: 'BLOCKED', reason: 'OPENHANDS_TARGET_SHA_MISMATCH', currentSha, targetSha });
  }
  if (branch !== 'execution') {
    return Object.freeze({ status: 'BLOCKED', reason: 'OPENHANDS_MUTATION_BRANCH_INVALID', branch });
  }
  if (git(targetDir, ['status', '--porcelain'])) {
    return Object.freeze({ status: 'BLOCKED', reason: 'OPENHANDS_SOURCE_WORKTREE_DIRTY' });
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-openhands-'));
  const workspace = path.join(tempRoot, 'workspace');
  const failurePath = path.join(tempRoot, 'failure.log');
  const promptPath = path.join(tempRoot, 'prompt.txt');
  const outputPath = path.join(tempRoot, 'advisor.json');

  try {
    execFileSync('git', ['-C', targetDir, 'worktree', 'add', '--detach', workspace, targetSha], {
      stdio: 'pipe',
    });
    fs.writeFileSync(failurePath, String(failureLog ?? ''), 'utf8');
    fs.writeFileSync(
      promptPath,
      buildOpenHandsAdvisorPrompt({ targetSha, failureFingerprint, diagnosis, failureLog }),
      'utf8',
    );

    const python = process.env.FLIXO_OPENHANDS_PYTHON || 'python3';
    const env = {
      ...process.env,
      FLIXO_OPENHANDS_WORKSPACE: workspace,
      FLIXO_OPENHANDS_TARGET_SHA: targetSha,
      FLIXO_OPENHANDS_FAILURE_LOG: failurePath,
      FLIXO_OPENHANDS_PROMPT_PATH: promptPath,
      FLIXO_OPENHANDS_OUTPUT: outputPath,
    };

    let raw = '';
    try {
      raw = execFileSync(python, ['scripts/ci/auto-repair/openhands-repair-advisor.py'], {
        cwd: targetDir,
        env,
        encoding: 'utf8',
        timeout: Number(process.env.FLIXO_OPENHANDS_TIMEOUT_MS ?? 240000),
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch (error) {
      if (fs.existsSync(outputPath)) {
        return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      }
      return Object.freeze({
        status: 'BLOCKED_EXTERNAL',
        protocol: 'FLIXO-OPENHANDS-REPAIR-ADVISOR-v1',
        reason: 'OPENHANDS_RUNTIME_UNAVAILABLE',
        errorType: error?.name ?? 'Error',
        error: String(error?.message ?? error).slice(0, 1000),
        targetSha,
      });
    }

    if (fs.existsSync(outputPath)) {
      return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    }

    try {
      return JSON.parse(raw.trim().split('\n').at(-1) ?? '{}');
    } catch {
      return Object.freeze({
        status: 'BLOCKED_EXTERNAL',
        protocol: 'FLIXO-OPENHANDS-REPAIR-ADVISOR-v1',
        reason: 'OPENHANDS_INVALID_OUTPUT',
        targetSha,
      });
    }
  } finally {
    try {
      execFileSync('git', ['-C', targetDir, 'worktree', 'remove', '--force', workspace], { stdio: 'ignore' });
    } catch {
      // Preserve the primary advisor evidence; cleanup failure is external and must not mutate source.
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('openhands-repair-advisor.mjs') && process.argv[2] === '--self-test') {
  process.env.FLIXO_OPENHANDS_ADVISOR_ENABLED = 'false';
  const result = runOpenHandsRepairAdvisor({ targetSha: 'a'.repeat(40) });
  if (result.status !== 'DISABLED') process.exit(1);
  console.log('OPENHANDS_REPAIR_ADVISOR_SELF_TEST=PASS');
}
