#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIAG_DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIAG_DIR, { recursive: true });
const args = process.argv.slice(2);
const gateArg = args.find((arg) => arg.startsWith('--gate='));
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const gate = gateArg?.slice(7) || null;
const mode = modeArg?.slice(7) || 'certification';
const GATES = ['static', 'build', 'browser'];
if (!['certification', 'diagnose'].includes(mode) || (gate && !GATES.includes(gate))) {
  console.error('Usage: node scripts/test.mjs [--mode=certification|diagnose] [--gate=static|build|browser]');
  process.exit(2);
}
const now = () => new Date().toISOString();
const git = (args) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'UNKNOWN';
};
const sha = () => git(['rev-parse', 'HEAD']);
const rootCauseRegistry = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));
const runNodeScript = (script, args = []) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, env: process.env, encoding: 'utf8' });

const CHECKS = {
  static: [
    ['typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false'], 'RC-TYPE-001'],
    ['lint', 'npm', ['run', 'lint'], 'RC-TYPE-001'],
    ['unit', 'npm', ['run', 'test:unit'], 'RC-UNKNOWN-001'],
    ['tool-localization', 'npm', ['run', 'test:tool-localization'], 'RC-I18N-001'],
    ['baseline', 'npm', ['run', 'validate:baseline'], 'RC-UNKNOWN-001'],
    ['tool-registry', 'npm', ['run', 'validate:tool-registry'], 'RC-UNKNOWN-001'],
    ['tool-manifest', 'npm', ['run', 'validate:tool-manifest'], 'RC-UNKNOWN-001'],
    ['router', 'npm', ['run', 'validate:router-registry'], 'RC-ROUTER-001'],
    ['i18n', 'npm', ['run', 'validate:i18n'], 'RC-I18N-001'],
    ['language-quality', 'npm', ['run', 'validate:language-quality'], 'RC-I18N-001'],
    ['locale-integrity', 'npm', ['run', 'validate:locale-integrity'], 'RC-I18N-001'],
    ['locale-navigation', 'npm', ['run', 'validate:locale-navigation'], 'RC-I18N-001'],
    ['home-i18n', 'npm', ['run', 'validate:home-i18n'], 'RC-I18N-001'],
    ['localization-complete', 'npm', ['run', 'validate:localization-complete'], 'RC-I18N-001'],
    ['seo', 'npm', ['run', 'validate:seo'], 'RC-SEO-001'],
    ['seo-manifest', 'npm', ['run', 'validate:seo-manifest'], 'RC-SEO-001'],
    ['indexing', 'npm', ['run', 'validate:indexing'], 'RC-SEO-001'],
    ['breadcrumb-seo', 'npm', ['run', 'validate:breadcrumb-seo'], 'RC-SEO-001'],
    ['ci-contract', 'npm', ['run', 'validate:ci-contract'], 'RC-CI-CONTRACT-001'],
    ['image-only', 'npm', ['run', 'validate:image-only-closure'], 'RC-UNKNOWN-001'],
    ['dependency-zero-debt', 'npm', ['run', 'validate:dependency-zero-debt'], 'RC-DEPENDENCY-001'],
    ['technical-debt-audit', 'npm', ['run', 'audit:technical-debt'], 'RC-CI-TECHNICAL-DEBT-001'],
  ],
  build: [
    ['typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false'], 'RC-TYPE-001'],
    ['build', 'npm', ['run', 'build'], 'RC-BUILD-001'],
    ['dist', 'node', ['-e', "const fs=require('node:fs'); for (const p of ['dist','dist/index.html']) if (!fs.existsSync(p)) throw new Error('Missing build output: '+p); console.log('Build output verified')"], 'RC-BUILD-001'],
  ],
};
const EXPECTED_CHECKS = Object.fromEntries(Object.entries(CHECKS).map(([name, checks]) => [name, checks.length]));
EXPECTED_CHECKS.browser = 3;

function execute(label, command, commandArgs, env = {}) {
  const startedAt = now();
  const result = spawnSync(command, commandArgs, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  const output = `${stdout}\n${stderr}`.slice(-16000);
  return { label, command: [command, ...commandArgs].join(' '), status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status ?? 1, startedAt, completedAt: now(), output };
}

function normalizeError(output) {
  return output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/https?:\/\/[^\s]+/g, '<URL>')
    .replace(/[A-Za-z]:\\[^\s]+/g, '<PATH>')
    .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '<PATH>')
    .replace(/[0-9a-f]{7,40}/gi, '<SHA>')
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ').trim();
}

function stableFailureSignature(check) {
  const relevant = check.output.split(/\r?\n/).map(normalizeError)
    .filter((line) => /error|failed|failure|cannot|not assignable|not found|expected|received|timeout|exception|assert|locale|route|canonical|hreflang|playwright|chromium|firefox|webkit/i.test(line))
    .filter(Boolean);
  return [...new Set(relevant)].sort().slice(0, 40).join(' ').slice(0, 5000);
}

const FALLBACK_RULES = [
  ['RC-DEPENDENCY-001', /cannot find module|npm err|npm ci|lockfile|package-lock|ERESOLVE/i],
  ['RC-TYPE-001', /TS\d+|Type error|type .* is not assignable|cannot find name/i],
  ['RC-ROUTER-001', /route|404|not found|path resolver|localized path/i],
  ['RC-I18N-001', /translation|locale|language|English leakage|localized title|localized description/i],
  ['RC-SEO-001', /canonical|hreflang|robots|sitemap|seo/i],
  ['RC-A11Y-001', /accessib|aria|landmark|accessible name/i],
  ['RC-RUNTIME-001', /console|uncaught|exception|runtime error|pageerror/i],
  ['RC-NETWORK-001', /network|request failed|ERR_|ECONN|timeout/i],
  ['RC-BUILD-001', /build failed|vite.*error|rollup|esbuild|failed to build/i],
];
function classify(gateName, check, declaredRootCause) {
  if (check.status === 'PASS') return null;
  if (declaredRootCause && rootCauseRegistry[declaredRootCause]) return declaredRootCause;
  for (const [id, pattern] of FALLBACK_RULES) if (pattern.test(check.output)) return id;
  return gateName === 'browser' ? 'RC-BROWSER-001' : 'RC-UNKNOWN-001';
}
function fingerprint(gateName, check, rootCauseId) {
  return `FPR-${createHash('sha256').update([rootCauseId, gateName, check.label, stableFailureSignature(check)].join('\n')).digest('hex').slice(0, 12).toUpperCase()}`;
}
function repro(gateName, check) {
  return gateName === 'browser' ? `npx playwright test --project=${check.label}` : check.command;
}
function enrich(gateName, check, declaredRootCause) {
  const rootCauseId = classify(gateName, check, declaredRootCause);
  if (check.status === 'PASS') return { ...check, rootCauseId: null, fingerprint: null, repro: null, error: null };
  return { ...check, rootCauseId, fingerprint: fingerprint(gateName, check, rootCauseId), repro: repro(gateName, check), error: { category: rootCauseRegistry[rootCauseId]?.category ?? 'UNKNOWN', normalized: normalizeError(check.output).slice(-4000) } };
}
function writeGateReport(gateName, results, status) {
  const checks = results.map((item) => enrich(gateName, item.result, item.rootCauseId));
  const failures = checks.filter((item) => item.status === 'FAIL');
  const report = { version: 5, schema: 'flixo-gate-report/v5', sha: sha(), gate: gateName.toUpperCase(), mode, status, failures: failures.length, checksExpected: EXPECTED_CHECKS[gateName], checksExecuted: checks.length, rootCauses: [...new Set(failures.map((item) => item.rootCauseId).filter(Boolean))], completedAt: now(), checks };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
function runChecks(gateName) {
  const results = [];
  for (const [label, command, commandArgs, rootCauseId] of CHECKS[gateName]) {
    const result = execute(label, command, commandArgs);
    results.push({ result, rootCauseId });
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport(gateName, results, results.length === EXPECTED_CHECKS[gateName] && results.every((item) => item.result.status === 'PASS') ? 'PASS' : 'FAIL');
}
function browserGate() {
  const results = [];
  for (const project of ['chromium', 'firefox', 'webkit']) {
    const result = execute(project, 'npx', ['playwright', 'test', `--project=${project}`], { CI: 'true', PLAYWRIGHT_REUSE_SERVER: 'false', PLAYWRIGHT_SERVER: 'production' });
    results.push({ result, rootCauseId: 'RC-BROWSER-001' });
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport('browser', results, results.length === 3 && results.every((item) => item.result.status === 'PASS') ? 'PASS' : 'FAIL');
}
function blockedReport(gateName, reason) {
  const report = { version: 5, schema: 'flixo-gate-report/v5', sha: sha(), gate: gateName.toUpperCase(), mode, status: 'BLOCKED', failures: 0, checksExpected: EXPECTED_CHECKS[gateName], checksExecuted: 0, rootCauses: ['RC-BUILD-001'], completedAt: now(), blockedBy: reason, checks: [] };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
function clusterFailures(reports) {
  const clusters = new Map();
  for (const report of reports) for (const check of (report.checks ?? []).filter((item) => item.status === 'FAIL')) {
    const key = check.rootCauseId ?? 'RC-UNKNOWN-001';
    const cluster = clusters.get(key) ?? { rootCauseId: key, occurrences: 0, fingerprints: new Set(), affectedChecks: [], repro: check.repro ?? null };
    cluster.occurrences += 1;
    if (check.fingerprint) cluster.fingerprints.add(check.fingerprint);
    cluster.affectedChecks.push({ gate: report.gate, label: check.label, exitCode: check.exitCode });
    clusters.set(key, cluster);
  }
  return [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints] }));
}
function writeOverall(reports, targetGates) {
  const failures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL'));
  const clusters = clusterFailures(reports);
  const complete = reports.length === targetGates.length && reports.every((report) => report.status === 'PASS' && report.checksExpected === report.checksExecuted);
  const overall = { version: 5, schema: 'flixo-ci-report/v5', mode, sha: sha(), status: complete && failures.length === 0 ? 'PASS' : 'FAIL', gatesExpected: targetGates.length, gatesExecuted: reports.length, rootCauses: clusters.map((cluster) => cluster.rootCauseId), firstFailure: failures[0] ? { gate: reports.find((r) => r.checks?.some((c) => c.label === failures[0].label))?.gate ?? null, rootCauseId: failures[0].rootCauseId, fingerprint: failures[0].fingerprint, repro: failures[0].repro } : null, clusters, completedAt: now() };
  writeFileSync(resolve(DIAG_DIR, 'report.json'), `${JSON.stringify(overall, null, 2)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'failures.json'), `${JSON.stringify(clusters, null, 2)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'report.md'), `# CI Report\n\nSTATUS: ${overall.status}\nSHA: ${overall.sha}\nMODE: ${mode}\n\nROOT CAUSES: ${overall.rootCauses.join(', ') || 'NONE'}\n\n${reports.map((r) => `- ${r.gate}: ${r.status} (${r.checksExecuted}/${r.checksExpected})`).join('\n')}\n`);
  console.log(JSON.stringify(overall, null, 2));
  return overall;
}

const currentSha = sha();
const expectedSha = process.env.EXPECTED_SHA;
if (expectedSha && expectedSha !== currentSha) {
  console.error(`EXACT SHA VIOLATION: expected ${expectedSha}, executed ${currentSha}`);
  process.exit(1);
}
if (!existsSync(resolve(ROOT, 'node_modules/.package-lock.json'))) {
  console.error('DEPENDENCY STATE VIOLATION: npm ci must complete before certification runner.');
  process.exit(1);
}
const context = runNodeScript('scripts/ci/capture-execution-context.mjs');
process.stdout.write(context.stdout ?? '');
process.stderr.write(context.stderr ?? '');
if ((context.status ?? 1) !== 0) process.exit(context.status ?? 1);

const targetGates = gate ? [gate] : GATES;
const reports = [];
for (const name of targetGates) {
  const report = name === 'static' ? runChecks('static') : name === 'build' ? runChecks('build') : (reports.find((item) => item.gate === 'BUILD')?.status !== 'PASS' ? blockedReport('browser', 'BUILD did not pass; browser artifact certification is not valid') : browserGate());
  reports.push(report);
  if (mode === 'certification' && report.status !== 'PASS') break;
}
const overall = writeOverall(reports, targetGates);
for (const script of ['scripts/ci/normalize-reproduction.mjs', 'scripts/ci/collect-failure-evidence.mjs', 'scripts/ci/record-repair-cycle.mjs', 'scripts/ci/detect-shared-root-candidates.mjs']) {
  const result = runNodeScript(script);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if ((result.status ?? 1) !== 0) console.error(`Supporting diagnostic ${script} returned ${result.status ?? 1}.`);
}
process.exit(overall.status === 'PASS' ? 0 : 1);
