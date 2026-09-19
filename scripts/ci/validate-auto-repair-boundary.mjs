#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const AUTO_REPAIR = path.join(ROOT, '.github', 'workflows', 'auto-repair.yml');
const WATCHDOG = path.join(ROOT, '.github', 'workflows', 'execution-bot-watchdog.yml');
const MAX_CHANGED_FILES = 12;
const MAX_CHANGED_LINES = 300;

export const CONTROL_PLANE_FILES = Object.freeze([
  '.github/workflows/auto-repair.yml',
  '.github/workflows/execution-bot-watchdog.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
  '.github/workflows/agent-repair-handoff-gate.yml',
  'scripts/ci/validate-auto-repair-boundary.mjs',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repair-strategy.mjs',
  'scripts/ci/auto-repair-supervisor.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/continuous-error-watch.mjs',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-ci-cd-trust.mjs',
  'AGENTS.md',
  'docs/agents/TASK-AGENT.md',
  'docs/agents/CONTINUOUS-ERROR-WATCH-REPAIR-PROTOCOL.md',
]);

const denyPath = (p) =>
  /(^|\/)\.env(?:\.|$)/i.test(p) ||
  /\.(pem|key|p12|pfx)$/i.test(p) ||
  /(^|\/)secrets?\//i.test(p);

const fail = (message) => { throw new Error('AUTO_REPAIR_BOUNDARY_VIOLATION=' + message); };

function read(file) {
  if (!fs.existsSync(file)) fail(`missing-control-plane-file:${path.relative(ROOT, file)}`);
  return fs.readFileSync(file, 'utf8');
}

export function validateStatic() {
  const auto = read(AUTO_REPAIR);
  const watchdog = read(WATCHDOG);
  const errors = [];
  const must = (condition, code) => { if (!condition) errors.push(code); };

  must(/name:\s*FLIXO Auto Repair Bot/.test(auto), 'auto-repair-identity');
  must(/workflow_run:\s*\n\s*workflows:/.test(auto), 'auto-repair-workflow-run-trigger');
  must(/branches:\s*\[main, execution\]/.test(auto), 'auto-repair-two-branch-trigger');
  must(/target_run_id:[\s\S]*required:\s*true/.test(auto), 'auto-repair-target-run-required');
  must(/ref:\s*execution/.test(auto), 'auto-repair-checkout-execution');
  must(/contents:\s*write/.test(auto) && /actions:\s*write/.test(auto) && /pull-requests:\s*write/.test(auto), 'auto-repair-required-permissions');
  must(/checks:\s*read/.test(auto), 'auto-repair-check-permission');
  must(/cancel-in-progress:\s*false/.test(auto), 'auto-repair-single-lane');
  must(/FLIXO_STRICT_RED_REPAIR:\s*['"]true['"]/.test(auto), 'auto-repair-strict-red');
  must(/not a diagnosable failure/.test(auto), 'auto-repair-failure-only-policy');
  must(/cannot repair itself/.test(auto), 'auto-repair-self-protection');
  must(!/continue-on-error:\s*true/i.test(auto), 'auto-repair-no-continue-on-error');
  must(!/git\s+(checkout|switch)\s+-[bc]/.test(auto), 'auto-repair-no-third-branch');
  must(!/git\s+push[^\n]*\bmain\b/.test(auto), 'auto-repair-no-main-push');
  must(!/gh\s+pr\s+merge/i.test(auto), 'auto-repair-no-self-merge');

  const timeout = Number(auto.match(/jobs:\s*\n\s+repair:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1] ?? NaN);
  must(Number.isFinite(timeout) && timeout <= 45, 'auto-repair-timeout-bound');

  must(/name:\s*FLIXO Execution Bot Watchdog/.test(watchdog), 'watchdog-identity');
  must(/workflow_run:\s*\n\s*types:\s*\[requested, in_progress, completed\]/.test(watchdog), 'watchdog-lifecycle-trigger');
  must(/schedule:\s*\n\s*- cron:\s*['"]\*\/5 \* \* \* \*['"]/.test(watchdog), 'watchdog-persistence-schedule');
  must(/push:\s*\n\s*branches:\s*\[execution\]/.test(watchdog), 'watchdog-execution-push');
  must(/pull_request:\s*\n\s*types:\s*\[opened, synchronize, reopened\]\s*\n\s*branches:\s*\[main\]/.test(watchdog), 'watchdog-main-pr-observer');
  must(/actions:\s*write/.test(watchdog) && /contents:\s*read/.test(watchdog), 'watchdog-permissions');
  must(/--workflow auto-repair\.yml[\s\S]*--ref execution/.test(watchdog), 'watchdog-canonical-dispatch');
  must(!/git\s+(checkout|switch)\s+-[bc]/.test(watchdog), 'watchdog-no-third-branch');
  must(!/git\s+push[^\n]*\bmain\b/.test(watchdog), 'watchdog-no-main-push');

  if (errors.length) fail(errors.join(','));
  return { status: 'PASS', maxChangedFiles: MAX_CHANGED_FILES, maxChangedLines: MAX_CHANGED_LINES, controlPlaneFiles: [...CONTROL_PLANE_FILES] };
}

export function validateDiff() {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (branch !== 'execution') fail('mutation-branch:' + branch);
  const raw = execFileSync('git', ['diff', '--name-status'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!raw) return { status: 'PASS', changedFiles: 0, changedLines: 0 };
  const entries = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const [status, ...rest] = line.split(/\s+/);
    return { status, path: rest.at(-1) };
  });
  if (entries.length > MAX_CHANGED_FILES) fail(`changed-files:${entries.length}>${MAX_CHANGED_FILES}`);
  const protectedChanged = entries.filter(({ path: p }) => CONTROL_PLANE_FILES.includes(p));
  if (protectedChanged.length) fail('control-plane-mutation:' + protectedChanged.map((x) => x.path).join(','));
  const denied = entries.filter(({ path: p }) => denyPath(p));
  if (denied.length) fail('sensitive-path-mutation:' + denied.map((x) => x.path).join(','));
  const numstat = execFileSync('git', ['diff', '--numstat'], { cwd: ROOT, encoding: 'utf8' }).trim();
  let changedLines = 0;
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const [add, del] = line.split(/\s+/).map(Number);
    changedLines += (Number.isFinite(add) ? add : 0) + (Number.isFinite(del) ? del : 0);
  }
  if (changedLines > MAX_CHANGED_LINES) fail(`changed-lines:${changedLines}>${MAX_CHANGED_LINES}`);
  return { status: 'PASS', changedFiles: entries.length, changedLines };
}

const mode = process.argv.includes('--diff-only') ? 'diff' : process.argv.includes('--static-only') ? 'static' : 'both';
const result = mode === 'static' ? validateStatic() : mode === 'diff' ? validateDiff() : { static: validateStatic(), diff: validateDiff() };
console.log(JSON.stringify(result, null, 2));
