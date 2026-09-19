import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function classifyReproductionRuns(runs = []) {
  if (!Array.isArray(runs) || runs.length === 0) return 'NO_TARGET';
  const passed = runs.filter((run) => run?.ok === true).length;
  if (passed === runs.length) return 'STABLE_PASS';
  if (passed === 0) return 'REPRODUCIBLE_FAILURE';
  return 'FLAKY_SUSPECTED';
}

export function checkVerificationContamination({ changedPaths = [], selection = {} } = {}) {
  const changed = new Set(changedPaths.map((value) => String(value ?? '').replaceAll('\\', '/')));
  const blocked = [];
  const targetSpec = String(selection?.target?.spec ?? '');
  const controls = new Set([
    'scripts/ci/auto-repair/reproduction.mjs',
    'scripts/ci/auto-repair/verification.mjs',
    'scripts/ci/auto-repair-proof.mjs',
    'scripts/ci/assertion-registry.json',
    'scripts/ci/auto-repair/ai-phase1.mjs',
  ]);
  if (targetSpec && changed.has(targetSpec)) blocked.push('target-test-changed:' + targetSpec);
  for (const file of controls) if (changed.has(file)) blocked.push('verification-control-changed:' + file);
  for (const file of changed) {
    if (file.startsWith('tests/') || file.startsWith('scripts/ci/test-')) blocked.push('test-surface-changed:' + file);
  }
  return Object.freeze({ ok: blocked.length === 0, blocked, changedPaths: [...changed] });
}

export function buildVerificationPlan(selection, identity = {}) {
  const exact = selection?.exact === true && identity?.ok === true;
  return Object.freeze({
    schemaVersion: 1,
    scope: selection?.scope ?? 'NONE',
    exact,
    identity,
    target: selection?.target ?? null,
    confidence: exact ? selection?.confidence ?? 0 : 0,
    baselineAttempts: exact ? 3 : 0,
    afterAttempts: exact ? 2 : 0,
    testCreation: 'DISABLED',
  });
}

const fileExists = (root, file) => Boolean(file && fs.existsSync(path.resolve(root, file)));

export function verifyTargetIdentity(targetDir, selection, { timeoutMs = 120000 } = {}) {
  if (!selection?.exact || !selection?.target) return Object.freeze({ ok: false, reason: 'non-exact-target', matches: 0, command: null });
  const target = selection.target;
  if (!fileExists(targetDir, target.spec)) return Object.freeze({ ok: false, reason: 'target-file-missing', matches: 0, command: null });
  if (selection.strategy !== 'exact-test') return Object.freeze({ ok: true, reason: 'path-identity-unique', matches: 1, command: null });
  const args = ['--no-install', 'playwright', 'test', target.spec, '--list', '--grep', target.grep, '--retries=0'];
  if (target.browser) args.push('--project', target.browser);
  try {
    const output = execFileSync('npx', args, {
      cwd: targetDir,
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: process.env.CI || 'true' },
    });
    const lines = String(output).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const matches = lines.filter((line) => line.includes(target.spec) && line.includes('›')).length;
    return Object.freeze(matches === 1
      ? { ok: true, reason: 'unique-playwright-test', matches, command: ['npx', args], output: lines.join('\n') }
      : { ok: false, reason: matches === 0 ? 'target-test-not-found' : 'target-test-not-unique', matches, command: ['npx', args], output: lines.join('\n') });
  } catch (error) {
    const details = String(error?.stderr?.toString?.() ?? error?.stdout?.toString?.() ?? error?.message ?? error);
    return Object.freeze({ ok: false, reason: 'target-list-failed', matches: 0, command: ['npx', args], output: details.slice(0, 4000) });
  }
}

export function reproduceStable(targetDir, commands, reproduceFn, { attempts = 3 } = {}) {
  if (typeof reproduceFn !== 'function' || !Array.isArray(commands) || !commands.length || !Number.isInteger(attempts) || attempts < 1) {
    return Object.freeze({ attempts: 0, runs: [], classification: 'NO_TARGET', ok: false });
  }
  const runs = [];
  for (let index = 0; index < attempts; index += 1) runs.push(reproduceFn(targetDir, commands));
  const classification = classifyReproductionRuns(runs);
  return Object.freeze({
    attempts: runs.length,
    runs,
    classification,
    ok: classification === 'STABLE_PASS',
    firstRun: runs[0] ?? null,
    lastRun: runs.at(-1) ?? null,
  });
}
