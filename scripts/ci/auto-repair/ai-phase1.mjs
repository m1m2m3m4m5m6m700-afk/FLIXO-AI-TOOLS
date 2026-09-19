#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fingerprintFailure, normalizeFailure, extractFeatures } from '../auto-repair-learning.mjs';
import { resolveTargetedTests } from './reproduction.mjs';
import { verifyTargetIdentity } from './verification.mjs';
import { calculateImpact } from '../impact/engine.ts';
import { CI_CONTRACTS } from '../contracts/registry.ts';

export const PHASE1_AGENTS = Object.freeze([
  'FAILURE_INTELLIGENCE',
  'EXACT_TARGETING',
  'IMPACT_ENGINE',
  'CI_ORCHESTRATOR',
  'CONCURRENCY_GUARD',
]);

const ROOT = process.cwd();
const LOG_PATH = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const REPORT_PATH = process.env.FLIXO_AI_PHASE1_PATH ?? '/tmp/flixo-ai-phase1.json';
const EXPECTED_SHA_FILE = process.env.FLIXO_CURRENT_TARGET_SHA_FILE ?? '/tmp/flixo-failed-sha';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function readExpectedSha() {
  if (process.env.FLIXO_EXPECTED_TARGET_SHA) return process.env.FLIXO_EXPECTED_TARGET_SHA.trim();
  if (fs.existsSync(EXPECTED_SHA_FILE)) return fs.readFileSync(EXPECTED_SHA_FILE, 'utf8').trim();
  return '';
}

function normalizeChangedFiles(files = []) {
  return [...new Set(files.map((file) => String(file ?? '').replaceAll('\\', '/').replace(/^\.\//u, '')).filter(Boolean))].sort();
}

export function failureIntelligence(log = '') {
  const text = String(log ?? '');
  return Object.freeze({
    fingerprint: fingerprintFailure(text),
    normalizedFailure: normalizeFailure(text),
    features: extractFeatures(text),
    evidencePresent: text.trim().length > 0,
  });
}

export function guardExecutionIdentity({ expectedSha, currentSha, remoteSha, branch = 'execution' } = {}) {
  const failures = [];
  if (branch !== 'execution') failures.push('BRANCH_NOT_EXECUTION');
  if (!/^[a-f0-9]{40}$/u.test(String(expectedSha ?? ''))) failures.push('EXPECTED_SHA_MISSING');
  if (expectedSha && currentSha && expectedSha !== currentSha) failures.push('LOCAL_SHA_MISMATCH');
  if (expectedSha && remoteSha && expectedSha !== remoteSha) failures.push('REMOTE_SHA_MOVED');
  return Object.freeze({
    ok: failures.length === 0,
    failures,
    expectedSha: expectedSha || null,
    currentSha: currentSha || null,
    remoteSha: remoteSha || null,
    branch,
  });
}

function levelRank(level) {
  return ({ L0: 0, L1: 1, L2: 2, L3: 3 })[level] ?? 3;
}

export function buildCiOrchestrationPlan({ impact, targetSelection } = {}) {
  const level = impact?.escalation ?? 'L3';
  const commands = [];
  if (targetSelection?.exact && targetSelection.commands?.length) commands.push(...targetSelection.commands);
  if (levelRank(level) >= 2) {
    commands.push(
      ['node', ['scripts/test.mjs', '--mode=diagnose', '--gate=static']],
      ['node', ['scripts/test.mjs', '--mode=diagnose', '--gate=build']],
    );
  }
  const seen = new Set();
  const dedupedCommands = commands.filter((command) => {
    const key = JSON.stringify(command);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    schemaVersion: 1,
    level,
    mode: level === 'L0'
      ? 'NO_ADDITIONAL_CI'
      : level === 'L1'
        ? 'TARGETED_ONLY'
        : level === 'L2'
          ? 'TARGETED_PLUS_STATIC_BUILD'
          : 'FULL_CANONICAL_CI',
    dispatchAuthority: 'DAILY_FLIXO_GREEN_GATE',
    executorAuthority: 'AUTO_REPAIR_BOT',
    canonicalCiRequired: levelRank(level) >= 2 || Boolean(impact?.changedFiles?.length),
    targetedCommandCount: targetSelection?.exact ? (targetSelection.commands?.length ?? 0) : 0,
    plannedCommands: dedupedCommands,
    affectedContracts: [...(impact?.affectedContracts ?? [])],
    escalationReasons: [...(impact?.reasons ?? [])],
  });
}

function readDiffNames() {
  const raw = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
  return normalizeChangedFiles(raw.split(/\r?\n/u));
}

export function buildPhase1Report({ mode, log = '', expectedSha = '', currentSha = '', remoteSha = '', branch = 'execution', targetSelection = null, targetIdentity = null, changedFiles = [] } = {}) {
  const intelligence = failureIntelligence(log);
  const impact = calculateImpact(normalizeChangedFiles(changedFiles), CI_CONTRACTS);
  const orchestration = buildCiOrchestrationPlan({ impact, targetSelection });
  const concurrency = guardExecutionIdentity({ expectedSha, currentSha, remoteSha, branch });
  return {
    schemaVersion: 1,
    protocol: 'FLIXO-AI-PHASE1',
    mode,
    agents: PHASE1_AGENTS,
    generatedAt: new Date().toISOString(),
    failureIntelligence: intelligence,
    exactTargeting: {
      selection: targetSelection,
      identity: targetIdentity,
      exact: Boolean(targetSelection?.exact && targetIdentity?.ok),
    },
    impact,
    ciOrchestration: orchestration,
    concurrencyGuard: concurrency,
  };
}

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
}

function preflight() {
  const log = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
  const expectedSha = readExpectedSha();
  const currentSha = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  execFileSync('git', ['fetch', '--no-tags', 'origin', 'execution'], { cwd: ROOT, stdio: 'inherit' });
  const remoteSha = git(['rev-parse', 'refs/remotes/origin/execution']);
  const intelligence = failureIntelligence(log);
  const targetSelection = resolveTargetedTests(log, intelligence.features, { targetDir: ROOT });
  const targetIdentity = verifyTargetIdentity(ROOT, targetSelection);
  const report = buildPhase1Report({
    mode: 'PREFLIGHT',
    log,
    expectedSha,
    currentSha,
    remoteSha,
    branch,
    targetSelection,
    targetIdentity,
    changedFiles: [],
  });
  report.preflightStatus = report.concurrencyGuard.ok
    ? report.exactTargeting.exact
      ? 'READY_FOR_ENGINE_VERIFICATION'
      : 'ENGINE_MUST_FAIL_CLOSED_ON_NON_EXACT_TARGET'
    : 'CONCURRENCY_BLOCKED';
  writeReport(report);
  if (!report.concurrencyGuard.ok) throw new Error('AI_PHASE1_CONCURRENCY_GUARD=' + report.concurrencyGuard.failures.join(','));
  console.log(JSON.stringify(report, null, 2));
}

function postflight() {
  const log = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
  const expectedSha = readExpectedSha();
  const currentSha = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  execFileSync('git', ['fetch', '--no-tags', 'origin', 'execution'], { cwd: ROOT, stdio: 'inherit' });
  const remoteSha = git(['rev-parse', 'refs/remotes/origin/execution']);
  const intelligence = failureIntelligence(log);
  const targetSelection = resolveTargetedTests(log, intelligence.features, { targetDir: ROOT });
  const targetIdentity = targetSelection.exact ? verifyTargetIdentity(ROOT, targetSelection) : { ok: false, reason: 'non-exact-target', matches: 0 };
  const report = buildPhase1Report({
    mode: 'POSTFLIGHT',
    log,
    expectedSha,
    currentSha,
    remoteSha,
    branch,
    targetSelection,
    targetIdentity,
    changedFiles: readDiffNames(),
  });
  writeReport(report);
  if (!report.concurrencyGuard.ok) throw new Error('AI_PHASE1_CONCURRENCY_GUARD=' + report.concurrencyGuard.failures.join(','));
  console.log(JSON.stringify(report, null, 2));
}

function assertPostflight() {
  if (!fs.existsSync(REPORT_PATH)) throw new Error('AI_PHASE1_REPORT_MISSING');
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  if (report.mode !== 'POSTFLIGHT') throw new Error('AI_PHASE1_REPORT_NOT_POSTFLIGHT');
  if (report.concurrencyGuard?.ok !== true) throw new Error('AI_PHASE1_CONCURRENCY_GUARD_FAILED');
  if (!Array.isArray(report.impact?.changedFiles)) throw new Error('AI_PHASE1_IMPACT_MISSING');
  if (report.ciOrchestration?.dispatchAuthority !== 'DAILY_FLIXO_GREEN_GATE') {
    throw new Error('AI_PHASE1_DISPATCH_AUTHORITY_DRIFT');
  }
  console.log('AI_PHASE1_POSTFLIGHT_ASSERT=PASS');
}

const mode = process.argv.includes('--preflight') ? 'preflight'
  : process.argv.includes('--postflight') ? 'postflight'
    : process.argv.includes('--assert-post') ? 'assert-post'
      : '';

if (mode === 'preflight') preflight();
else if (mode === 'postflight') postflight();
else if (mode === 'assert-post') assertPostflight();
else {
  console.error('Usage: node --experimental-strip-types scripts/ci/auto-repair/ai-phase1.mjs --preflight|--postflight|--assert-post');
  process.exit(2);
}
