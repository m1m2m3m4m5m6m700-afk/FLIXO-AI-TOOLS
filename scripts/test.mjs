#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIAG_DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIAG_DIR, { recursive: true });

const args = process.argv.slice(2);
const gateArg = args.find((arg) => arg.startsWith('--gate='));
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const gate = gateArg?.slice('--gate='.length) || null;
const mode = modeArg?.slice('--mode='.length) || 'certification';
const GATES = ['static', 'build', 'browser'];

if (!['certification', 'diagnose'].includes(mode) || (gate && !GATES.includes(gate))) {
  console.error('Usage: node scripts/test.mjs [--mode=certification|diagnose] [--gate=static|build|browser]');
  process.exit(2);
}

const now = () => new Date().toISOString();
const gitSha = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'UNKNOWN';
};

function run(label, command, commandArgs, env = {}) {
  const startedAt = now();
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return {
    label,
    command: [command, ...commandArgs].join(' '),
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? 1,
    startedAt,
    completedAt: now(),
    output: `${stdout}\n${stderr}`.slice(-16000),
  };
}

const RULES = [
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

function classify(gateName, check) {
  if (check.status === 'PASS') return null;
  if (check.label === 'npm-ci') return 'RC-DEPENDENCY-001';
  if (check.label === 'typescript') return 'RC-TYPE-001';
  if (check.label === 'build' || check.label === 'dist') return 'RC-BUILD-001';
  for (const [id, pattern] of RULES) if (pattern.test(check.output)) return id;
  if (gateName === 'browser') return 'RC-BROWSER-001';
  return 'RC-UNKNOWN-001';
}

function fingerprint(gateName, check, rootCauseId) {
  const normalized = check.output.replace(/\d+(?:\.\d+)?/g, '#').replace(/\s+/g, ' ').trim().slice(-4000);
  return createHash('sha256').update([gitSha(), gateName, check.label, rootCauseId ?? '', normalized].join('\n')).digest('hex');
}

function repro(gateName, check) {
  const base = `npm run test:${gateName}`;
  if (gateName === 'browser') return `${base} -- --grep "${check.label}"`;
  return base;
}

function enrich(gateName, check) {
  const rootCauseId = classify(gateName, check);
  return {
    ...check,
    rootCauseId,
    fingerprint: rootCauseId ? fingerprint(gateName, check, rootCauseId) : null,
    repro: rootCauseId ? repro(gateName, check) : null,
  };
}

function writeGateReport(gateName, results, status) {
  const checks = results.map((result) => enrich(gateName, result));
  const failures = checks.filter((result) => result.status === 'FAIL');
  const rootCauses = [...new Set(failures.map((result) => result.rootCauseId).filter(Boolean))];
  const report = {
    version: 2,
    sha: gitSha(),
    gate: gateName.toUpperCase(),
    status,
    rootCauses,
    failures: failures.length,
    checksExpected: checks.length,
    checksExecuted: checks.length,
    completedAt: now(),
    checks: checks.map(({ output, ...check }) => check),
  };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, checks };
}

function staticGate() {
  const commands = [
    ['typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false']],
    ['registry', 'npm', ['run', 'validate:tool-registry']],
    ['router', 'npm', ['run', 'validate:router-registry']],
    ['i18n', 'npm', ['run', 'validate:i18n']],
    ['language', 'npm', ['run', 'validate:language-quality']],
    ['seo', 'npm', ['run', 'validate:seo']],
    ['seo-manifest', 'npm', ['run', 'validate:seo-manifest']],
    ['image-only', 'npm', ['run', 'validate:image-only-closure']],
  ];
  const results = [];
  for (const [label, command, commandArgs] of commands) {
    const result = run(label, command, commandArgs);
    results.push(result);
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  return writeGateReport('static', results, results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
}

function buildGate() {
  const results = [];
  if (process.env.FLIXO_DEPENDENCIES_READY !== 'true') {
    const install = run('npm-ci', 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']);
    results.push(install);
    if (install.status === 'FAIL') return writeGateReport('build', results, 'FAIL');
  } else {
    results.push({ label: 'npm-ci', command: 'npm ci [already bootstrapped]', status: 'PASS', exitCode: 0, startedAt: now(), completedAt: now(), output: '' });
  }
  const typecheck = run('typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false']);
  results.push(typecheck);
  if (typecheck.status === 'FAIL') return writeGateReport('build', results, 'FAIL');
  const build = run('build', 'npm', ['run', 'build']);
  results.push(build);
  if (build.status === 'FAIL') return writeGateReport('build', results, 'FAIL');
  results.push(run('dist', 'node', ['-e', "const fs=require('node:fs'); for (const p of ['dist','dist/index.html']) if (!fs.existsSync(p)) throw new Error('Missing build output: '+p); console.log('Build output verified')"]));
  return writeGateReport('build', results, results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
}

function browserGate() {
  const result = run('playwright', 'npx', ['playwright', 'test', '--project=chromium', '--project=firefox', '--project=webkit'], {
    CI: 'true',
    PLAYWRIGHT_REUSE_SERVER: 'false',
  });
  return writeGateReport('browser', [result], result.status);
}

function clusterFailures(reports) {
  const clusters = new Map();
  for (const report of reports) {
    for (const check of report.checks.filter((item) => item.status === 'FAIL')) {
      const key = check.rootCauseId ?? 'RC-UNKNOWN-001';
      const current = clusters.get(key) ?? { rootCauseId: key, occurrences: 0, fingerprints: new Set(), repro: check.repro, checks: [] };
      current.occurrences += 1;
      if (check.fingerprint) current.fingerprints.add(check.fingerprint);
      current.checks.push({ gate: report.gate, label: check.label, exitCode: check.exitCode });
      clusters.set(key, current);
    }
  }
  return [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints] }));
}

function writeOverall(reports, targetGates) {
  const failures = reports.flatMap((report) => report.checks.filter((check) => check.status === 'FAIL'));
  const clusters = clusterFailures(reports);
  const overallStatus = reports.length === targetGates.length && reports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL';
  const firstFailure = failures[0] ?? null;
  const overall = {
    version: 2,
    mode,
    sha: gitSha(),
    status: overallStatus,
    gatesExpected: targetGates.length,
    gatesExecuted: reports.length,
    rootCauses: clusters.map((cluster) => cluster.rootCauseId),
    firstFailure: firstFailure ? { gate: reports.find((r) => r.checks.includes(firstFailure))?.gate, rootCauseId: firstFailure.rootCauseId, repro: firstFailure.repro } : null,
    clusters: clusters.map(({ checks, ...cluster }) => ({ ...cluster, affectedChecks: checks })),
    completedAt: now(),
  };
  writeFileSync(resolve(DIAG_DIR, 'report.json'), `${JSON.stringify(overall, null, 2)}\n`);
  const markdown = [
    '# CI Report', '',
    `STATUS: ${overallStatus}`,
    `SHA: ${overall.sha}`,
    `MODE: ${mode}`, '',
    `FIRST FAILURE: ${overall.firstFailure ? `${overall.firstFailure.rootCauseId} — ${overall.firstFailure.repro}` : 'NONE'}`, '',
    'ROOT CAUSE CLUSTERS:',
    ...(clusters.length ? clusters.map((cluster) => `- ${cluster.rootCauseId}: ${cluster.occurrences} failure(s), ${cluster.fingerprints.length} fingerprint(s) — ${cluster.repro}`) : ['- NONE']), '',
    'GATES:',
    ...reports.map((report) => `- ${report.gate}: ${report.status}${report.rootCauses.length ? ` (${report.rootCauses.join(', ')})` : ''}`), '',
  ];
  writeFileSync(resolve(DIAG_DIR, 'report.md'), `${markdown.join('\n')}\n`);
  writeFileSync(resolve(DIAG_DIR, 'failures.json'), `${JSON.stringify(clusters, null, 2)}\n`);
  console.log(JSON.stringify(overall, null, 2));
  return overall;
}

const targetGates = gate ? [gate] : GATES;
const reports = [];

if (!gate && process.env.FLIXO_DEPENDENCIES_READY !== 'true') {
  const bootstrap = run('npm-ci', 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']);
  if (bootstrap.status === 'FAIL') {
    const report = writeGateReport('build', [bootstrap], 'FAIL');
    reports.push(report);
    writeOverall(reports, targetGates);
    process.exit(1);
  }
  process.env.FLIXO_DEPENDENCIES_READY = 'true';
}

for (const name of targetGates) {
  const report = name === 'static' ? staticGate() : name === 'build' ? buildGate() : browserGate();
  reports.push(report);
  if (mode === 'certification' && report.status !== 'PASS') break;
}

const overall = writeOverall(reports, targetGates);
process.exit(overall.status === 'PASS' ? 0 : 1);
