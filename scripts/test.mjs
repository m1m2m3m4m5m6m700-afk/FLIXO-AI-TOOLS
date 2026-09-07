#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const EXPECTED_CHECKS = { static: 8, build: 3, browser: 3 };
if (!['certification', 'diagnose'].includes(mode) || (gate && !GATES.includes(gate))) {
  console.error('Usage: node scripts/test.mjs [--mode=certification|diagnose] [--gate=static|build|browser]');
  process.exit(2);
}
const now = () => new Date().toISOString();
const sha = () => {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'UNKNOWN';
};
const rootCauseRegistry = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));

function runNodeScript(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, env: process.env, encoding: 'utf8' });
}

function captureContext() {
  const result = runNodeScript('scripts/ci/capture-execution-context.mjs');
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return result.status ?? 1;
}

const CHECKS = {
  static: [
    ['typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false'], 'RC-TYPE-001'],
    ['registry', 'npm', ['run', 'validate:tool-registry'], 'RC-UNKNOWN-001'],
    ['router', 'npm', ['run', 'validate:router-registry'], 'RC-ROUTER-001'],
    ['i18n', 'npm', ['run', 'validate:i18n'], 'RC-I18N-001'],
    ['language', 'npm', ['run', 'validate:language-quality'], 'RC-I18N-001'],
    ['seo', 'npm', ['run', 'validate:seo'], 'RC-SEO-001'],
    ['seo-manifest', 'npm', ['run', 'validate:seo-manifest'], 'RC-SEO-001'],
    ['image-only', 'npm', ['run', 'validate:image-only-closure'], 'RC-UNKNOWN-001'],
  ],
  build: [
    ['typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false'], 'RC-TYPE-001'],
    ['build', 'npm', ['run', 'build'], 'RC-BUILD-001'],
    ['dist', 'node', ['-e', "const fs=require('node:fs'); for (const p of ['dist','dist/index.html']) if (!fs.existsSync(p)) throw new Error('Missing build output: '+p); console.log('Build output verified')"], 'RC-BUILD-001'],
  ],
};

function extractFiles(output) {
  const matches = output.match(/(?:^|\s)((?:src|scripts|tests|\.github)\/[A-Za-z0-9_./-]+\.(?:[cm]?[jt]sx?|json|yml|yaml|mjs|mts|css|md))/g) ?? [];
  return [...new Set(matches.map((value) => value.trim()))].slice(-50);
}

function extractDependencyContext(output) {
  const tokens = [];
  for (const line of output.split(/\r?\n/)) {
    if (/cannot find module|npm err|eresolve|ts\d+|type .* is not assignable|locale|route|canonical|hreflang|sitemap|playwright|firefox|chromium|webkit/i.test(line)) {
      tokens.push(line
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/https?:\/\/[^\s]+/g, '<URL>')
        .replace(/[A-Za-z]:\\[^\s]+/g, '<PATH>')
        .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '<PATH>')
        .replace(/[0-9a-f]{7,40}/gi, '<SHA>')
        .replace(/\d+(?:\.\d+)?/g, '#')
        .replace(/\s+/g, ' ')
        .trim());
    }
  }
  return [...new Set(tokens)].sort().slice(0, 30).join(' ').slice(0, 1800);
}

function execute(label, command, commandArgs, env = {}) {
  const startedAt = now();
  const result = spawnSync(command, commandArgs, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  const output = `${stdout}\n${stderr}`.slice(-16000);
  return {
    label,
    command: [command, ...commandArgs].join(' '),
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? 1,
    startedAt,
    completedAt: now(),
    output,
    files: extractFiles(output),
    dependencyContext: extractDependencyContext(output),
  };
}

function normalizeError(output) {
  return output
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/https?:\/\/[^\s]+/g, '<URL>')
    .replace(/[A-Za-z]:\\[^\s]+/g, '<PATH>')
    .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '<PATH>')
    .replace(/[0-9a-f]{7,40}/gi, '<SHA>')
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableFailureSignature(check) {
  const relevant = check.output.split(/\r?\n/)
    .map((line) => normalizeError(line))
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
  if (declaredRootCause && declaredRootCause !== 'RC-UNKNOWN-001' && rootCauseRegistry[declaredRootCause]) return declaredRootCause;
  for (const [id, pattern] of FALLBACK_RULES) if (pattern.test(check.output)) return id;
  if (gateName === 'browser') return 'RC-BROWSER-001';
  return declaredRootCause && rootCauseRegistry[declaredRootCause] ? declaredRootCause : 'RC-UNKNOWN-001';
}

function fingerprint(gateName, check, rootCauseId) {
  const signature = stableFailureSignature(check);
  const stableContext = check.dependencyContext ?? '';
  return `FPR-${createHash('sha256').update([rootCauseId, gateName, check.label, signature, stableContext].join('\n')).digest('hex').slice(0, 12).toUpperCase()}`;
}

function repro(gateName, check) {
  if (gateName === 'browser') return `npx playwright test --project=${check.label} tests/localization-runtime.spec.ts`;
  return `npm run test:${gateName}`;
}

function enrich(gateName, check, declaredRootCause) {
  const rootCauseId = classify(gateName, check, declaredRootCause);
  if (check.status === 'PASS') return { ...check, rootCauseId: null, fingerprint: null, repro: null, error: null };
  const normalizedError = normalizeError(check.output).slice(-4000);
  return {
    ...check,
    rootCauseId,
    fingerprint: fingerprint(gateName, check, rootCauseId),
    repro: repro(gateName, check),
    error: { category: rootCauseRegistry[rootCauseId]?.category ?? 'UNKNOWN', normalized: normalizedError },
  };
}

function writeGateReport(gateName, results, status) {
  const checks = results.map((item) => enrich(gateName, item.result, item.rootCauseId));
  const failures = checks.filter((item) => item.status === 'FAIL');
  const report = {
    version: 4,
    schema: 'flixo-gate-report/v4',
    sha: sha(),
    gate: gateName.toUpperCase(),
    mode,
    status,
    failures: failures.length,
    checksExpected: EXPECTED_CHECKS[gateName],
    checksExecuted: checks.filter((item) => item.status !== 'BLOCKED').length,
    rootCauses: [...new Set(failures.map((item) => item.rootCauseId).filter(Boolean))],
    completedAt: now(),
    checks,
  };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function staticGate() {
  const results = [];
  for (const [label, command, commandArgs, rootCauseId] of CHECKS.static) {
    const result = execute(label, command, commandArgs);
    results.push({ result, rootCauseId });
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport('static', results, results.length === CHECKS.static.length && results.every((item) => item.result.status === 'PASS') ? 'PASS' : 'FAIL');
}

function buildGate() {
  const results = [];
  for (const [label, command, commandArgs, rootCauseId] of CHECKS.build) {
    const result = execute(label, command, commandArgs);
    results.push({ result, rootCauseId });
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport('build', results, results.length === CHECKS.build.length && results.every((item) => item.result.status === 'PASS') ? 'PASS' : 'FAIL');
}

function browserGate() {
  const results = [];
  for (const project of ['chromium', 'firefox', 'webkit']) {
    const result = execute(project, 'npx', ['playwright', 'test', `--project=${project}`], { CI: 'true', PLAYWRIGHT_REUSE_SERVER: 'false' });
    results.push({ result, rootCauseId: 'RC-BROWSER-001' });
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport('browser', results, results.length === 3 && results.every((item) => item.result.status === 'PASS') ? 'PASS' : 'FAIL');
}

function blockedReport(gateName, reason) {
  const report = {
    version: 4,
    schema: 'flixo-gate-report/v4',
    sha: sha(),
    gate: gateName.toUpperCase(),
    mode,
    status: 'BLOCKED',
    failures: 0,
    checksExpected: EXPECTED_CHECKS[gateName],
    checksExecuted: 0,
    rootCauses: [],
    completedAt: now(),
    blockedBy: reason,
    checks: [],
  };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function clusterFailures(reports) {
  const clusters = new Map();
  for (const report of reports) {
    for (const check of (report.checks ?? []).filter((item) => item.status === 'FAIL')) {
      const key = check.rootCauseId ?? 'RC-UNKNOWN-001';
      const cluster = clusters.get(key) ?? { rootCauseId: key, occurrences: 0, fingerprints: new Set(), affectedChecks: [], repro: check.repro ?? null };
      cluster.occurrences += 1;
      if (check.fingerprint) cluster.fingerprints.add(check.fingerprint);
      cluster.affectedChecks.push({ gate: report.gate, label: check.label, exitCode: check.exitCode });
      clusters.set(key, cluster);
    }
  }
  return [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints] }));
}

function writeOverall(reports, targetGates) {
  const failures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL'));
  const clusters = clusterFailures(reports);
  const overallStatus = reports.length === targetGates.length && reports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL';
  const firstFailure = failures[0] ?? null;
  const firstFailureReport = firstFailure ? reports.find((report) => report.checks?.some((check) => check.label === firstFailure.label && check.exitCode === firstFailure.exitCode)) : null;
  const overall = {
    version: 4,
    schema: 'flixo-ci-report/v4',
    mode,
    sha: sha(),
    status: overallStatus,
    gatesExpected: targetGates.length,
    gatesExecuted: reports.length,
    rootCauses: clusters.map((cluster) => cluster.rootCauseId),
    firstFailure: firstFailure ? { gate: firstFailureReport?.gate ?? null, rootCauseId: firstFailure.rootCauseId, fingerprint: firstFailure.fingerprint, repro: firstFailure.repro } : null,
    clusters,
    completedAt: now(),
  };
  writeFileSync(resolve(DIAG_DIR, 'report.json'), `${JSON.stringify(overall, null, 2)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'failures.json'), `${JSON.stringify(clusters, null, 2)}\n`);
  const markdown = [
    '# CI Report', '', `STATUS: ${overallStatus}`, `SHA: ${overall.sha}`, `MODE: ${mode}`, '',
    `FIRST FAILURE: ${overall.firstFailure ? `${overall.firstFailure.rootCauseId} / ${overall.firstFailure.fingerprint} — ${overall.firstFailure.repro}` : 'NONE'}`, '',
    'ROOT CAUSE CLUSTERS:',
    ...(clusters.length ? clusters.map((cluster) => `- ${cluster.rootCauseId}: ${cluster.occurrences} occurrence(s), ${cluster.fingerprints.join(', ') || 'no fingerprint'} — ${cluster.repro ?? 'no focused repro'}`) : ['- NONE']), '',
    'GATES:', ...reports.map((report) => `- ${report.gate}: ${report.status}`), '',
  ];
  writeFileSync(resolve(DIAG_DIR, 'report.md'), `${markdown.join('\n')}\n`);
  console.log(JSON.stringify(overall, null, 2));
  return overall;
}

const targetGates = gate ? [gate] : GATES;
const contextStatus = captureContext();
if (contextStatus !== 0) console.error(`Execution context capture returned ${contextStatus}; continuing with test diagnostics.`);

const reports = [];
for (const name of targetGates) {
  let report;
  if (name === 'static') report = staticGate();
  else if (name === 'build') report = buildGate();
  else {
    const build = reports.find((item) => item.gate === 'BUILD');
    report = build && build.status !== 'PASS' ? blockedReport('browser', `BUILD ${build.status}; browser scope intentionally not executed`) : browserGate();
  }
  reports.push(report);
  if (mode === 'certification' && report.status !== 'PASS') break;
}

const overall = writeOverall(reports, targetGates);

for (const script of [
  ['scripts/ci/normalize-reproduction.mjs', []],
  ['scripts/ci/collect-failure-evidence.mjs', []],
  ['scripts/ci/record-repair-cycle.mjs', []],
  ['scripts/ci/detect-shared-root-candidates.mjs', []],
]) {
  const result = runNodeScript(script[0], script[1]);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if ((result.status ?? 1) !== 0) console.error(`Supporting diagnostic ${script[0]} returned ${result.status ?? 1}; product gate status remains authoritative.`);
}

process.exit(overall.status === 'PASS' ? 0 : 1);
