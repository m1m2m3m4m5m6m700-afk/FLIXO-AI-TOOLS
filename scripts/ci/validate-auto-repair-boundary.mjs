#!/usr/bin/env node
import { REPAIR_GATE_AUTOMATION } from './control-plane-registry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const AUTO_REPAIR = path.join(ROOT, '.github', 'workflows', 'auto-repair.yml');
const DAILY_GATE = path.join(ROOT, '.github', 'workflows', 'daily-flixo-green-gate.yml');
const HANDOFF_GATE = path.join(ROOT, '.github', 'workflows', 'agent-repair-handoff-gate.yml');
const MAX_CHANGED_FILES = 12;
const MAX_CHANGED_LINES = 300;

export const CONTROL_PLANE_FILES = Object.freeze([
  ...REPAIR_GATE_AUTOMATION.map((name) => `.github/workflows/${name}`),
  '.github/workflows/agent-repair-handoff-gate.yml',
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/validate-auto-repair-boundary.mjs',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repair-strategy.mjs',
  'scripts/ci/auto-repair/ai-phase1.mjs',
  'scripts/ci/auto-repair/ai-phase2.mjs',
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
  const dailyGate = read(DAILY_GATE);
  const handoffGate = read(HANDOFF_GATE);
  const errors = [];
  const must = (condition, code) => { if (!condition) errors.push(code); };

  must(/name:\s*FLIXO Auto Repair Bot/.test(auto), 'auto-repair-identity');
  must(!/workflow_run:/.test(auto), 'auto-repair-executor-only-trigger');
  must(/workflow_dispatch:/.test(auto), 'auto-repair-dispatch-trigger');
  must(!/gh\s+workflow\s+run\s+auto-repair\.yml/i.test(auto), 'auto-repair-no-self-dispatch');
  must(/target_run_id:[\s\S]*required:\s*true/.test(auto), 'auto-repair-target-run-required');
  must(/ref:\s*execution/.test(auto), 'auto-repair-checkout-execution');
  must(/persist-credentials:\s*false/.test(auto), 'auto-repair-checkout-credential-isolation');
  must(/CONTROLLER_SHA="\$MAIN_SHA"/.test(auto), 'auto-repair-main-controller-trust');
  must(/TRUST_MODEL=MAIN_CONTROLLER_EXECUTION_TARGET/.test(auto), 'auto-repair-trust-model');
  must(/FLIXO_TRUSTED_CONTROLLER_SHA=\$CONTROLLER_SHA/.test(auto), 'auto-repair-controller-provenance');
  must(/contents:\s*write/.test(auto) && /actions:\s*write/.test(auto) && /pull-requests:\s*write/.test(auto), 'auto-repair-required-permissions');
  must(/checks:\s*read/.test(auto), 'auto-repair-check-permission');
  must(/cancel-in-progress:\s*false/.test(auto), 'auto-repair-single-lane');
  must(/FLIXO_STRICT_RED_REPAIR:\s*['"]true['"]/.test(auto), 'auto-repair-strict-red');
  must(/not a diagnosable failure/.test(auto), 'auto-repair-failure-only-policy');
  must(auto.includes('CURRENT_TARGET_SHA=') && auto.includes('FAIL CLOSED: repair target'), 'auto-repair-no-superseded-target');
  must(auto.includes('execution advanced during repair; refusing stale publication'), 'auto-repair-no-stale-publication');
  must(auto.includes('REMOTE_EXECUTION_SHA') && auto.includes('FAILED_SHA'), 'auto-repair-publication-exact-target');
  must(!/git rebase "\$REMOTE_EXECUTION_SHA"/.test(auto), 'auto-repair-no-stale-rebase');
  must(auto.includes('EVIDENCE_CAPTURE=FAILED'), 'auto-repair-evidence-capture-fail-closed');
  must(handoffGate.includes('branches: [execution]'), 'handoff-gate-execution-trigger');
  must(handoffGate.includes('CURRENT_EXECUTION_SHA=') && handoffGate.includes('HANDOFF_EXECUTION_SHA'), 'handoff-gate-current-head-check');
  must(/cannot repair itself/.test(auto), 'auto-repair-self-protection');
  must(!/continue-on-error:\s*true/i.test(auto), 'auto-repair-no-continue-on-error');
  must(!/git\s+(checkout|switch)\s+-[bc]/.test(auto), 'auto-repair-no-third-branch');
  must(!/git\s+push[^\n]*\bmain\b/.test(auto), 'auto-repair-no-main-push');
  must(!/gh\s+pr\s+merge/i.test(auto), 'auto-repair-no-self-merge');
  must(/gh\s+workflow\s+run\s+auto-repair\.yml[\s\S]*--ref execution/i.test(dailyGate), 'daily-gate-auto-repair-dispatch');
  must(!/gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/i.test(dailyGate), 'daily-gate-no-watchdog-dispatch');



  const timeout = Number(auto.match(/jobs:\s*\n\s+repair:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1] ?? NaN);
  must(Number.isFinite(timeout) && timeout <= 45, 'auto-repair-timeout-bound');

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
