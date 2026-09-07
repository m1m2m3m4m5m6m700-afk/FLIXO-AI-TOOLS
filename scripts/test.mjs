#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
if (mode !== 'certification' && mode !== 'diagnose') {
  console.error(`Invalid mode: ${mode}`);
  process.exit(2);
}
if (gate && !GATES.includes(gate)) {
  console.error(`Invalid gate: ${gate}`);
  process.exit(2);
}

function now() {
  return new Date().toISOString();
}

function sha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'UNKNOWN';
}

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
    stdout: stdout.slice(-12000),
    stderr: stderr.slice(-12000),
  };
}

function classify(gateName, results) {
  const failed = results.find((r) => r.status === 'FAIL');
  if (!failed) return null;
  if (gateName === 'static' && failed.label === 'dependencies') return 'RC-DEPENDENCY-001';
  if (gateName === 'static' && failed.label === 'typescript') return 'RC-TYPE-001';
  if (gateName === 'build') return 'RC-BUILD-001';
  if (gateName === 'browser') return 'RC-BROWSER-001';
  return 'RC-UNKNOWN-001';
}

function writeGateReport(gateName, results, status) {
  const rootCause = classify(gateName, results);
  const report = {
    version: 1,
    sha: sha(),
    gate: gateName.toUpperCase(),
    status,
    rootCauseId: rootCause,
    completedAt: now(),
    checksExpected: results.length,
    checksExecuted: results.length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    checks: results,
  };
  writeFileSync(resolve(DIAG_DIR, `${gateName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function staticGate() {
  const results = [];
  results.push(run('dependencies', 'npm', ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline']));
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
  for (const [label, command, commandArgs] of commands) {
    const result = run(label, command, commandArgs);
    results.push(result);
    if (mode === 'certification' && result.status === 'FAIL') break;
  }
  const status = results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
  return writeGateReport('static', results, status);
}

function buildGate() {
  const results = [];
  results.push(run('npm-ci', 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']));
  if (results[0].status === 'PASS') results.push(run('typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false']));
  if (results.every((r) => r.status === 'PASS')) results.push(run('build', 'npm', ['run', 'build']));
  if (results.every((r) => r.status === 'PASS')) {
    results.push(run('dist', 'node', ['-e', "const fs=require('node:fs'); for (const p of ['dist','dist/index.html']) if (!fs.existsSync(p)) throw new Error('Missing build output: '+p); console.log('Build output verified')"]));
  }
  const status = results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
  return writeGateReport('build', results, status);
}

function browserGate() {
  const results = [];
  results.push(run('playwright', 'npx', ['playwright', 'test', '--project=chromium', '--project=firefox', '--project=webkit'], {
    CI: 'true',
    PLAYWRIGHT_REUSE_SERVER: 'false',
  }));
  const status = results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
  return writeGateReport('browser', results, status);
}

function executeGate(name) {
  if (name === 'static') return staticGate();
  if (name === 'build') return buildGate();
  return browserGate();
}

const targetGates = gate ? [gate] : GATES;
const reports = [];
for (const name of targetGates) {
  const report = executeGate(name);
  reports.push(report);
  if (mode === 'certification' && report.status !== 'PASS') break;
}

const overallStatus = reports.length === targetGates.length && reports.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
const overall = {
  version: 1,
  mode,
  sha: sha(),
  status: overallStatus,
  gatesExpected: targetGates.length,
  gatesExecuted: reports.length,
  rootCauses: [...new Set(reports.map((r) => r.rootCauseId).filter(Boolean))],
  completedAt: now(),
  gates: reports.map((r) => ({ gate: r.gate, status: r.status, rootCauseId: r.rootCauseId })),
  repro: gate ? `npm run test:${gate}` : 'npm test',
};
writeFileSync(resolve(DIAG_DIR, 'report.json'), `${JSON.stringify(overall, null, 2)}\n`);
console.log(JSON.stringify(overall, null, 2));
process.exit(overallStatus === 'PASS' ? 0 : 1);
