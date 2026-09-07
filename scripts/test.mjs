#!/usr/bin/env node
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
  console.error(`Usage: node scripts/test.mjs [--mode=certification|diagnose] [--gate=static|build|browser]`);
  process.exit(2);
}

const now = () => new Date().toISOString();
const sha = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
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
    stdout: stdout.slice(-12000),
    stderr: stderr.slice(-12000),
  };
}

function classify(gateName, results) {
  const failed = results.find((r) => r.status === 'FAIL');
  if (!failed) return null;
  if ((gateName === 'static' || gateName === 'build') && ['dependencies', 'npm-ci'].includes(failed.label)) return 'RC-DEPENDENCY-001';
  if (failed.label === 'typescript') return 'RC-TYPE-001';
  if (gateName === 'build') return 'RC-BUILD-001';
  if (gateName === 'browser') return 'RC-BROWSER-001';
  return 'RC-UNKNOWN-001';
}

function writeGateReport(gateName, results, status) {
  const rootCauseId = classify(gateName, results);
  const report = {
    version: 1,
    sha: sha(),
    gate: gateName.toUpperCase(),
    status,
    rootCauseId,
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
  const results = [run('dependencies', 'npm', ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'])];
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
  return writeGateReport('static', results, results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
}

function buildGate() {
  const results = [];
  if (process.env.FLIXO_DEPENDENCIES_READY !== 'true') results.push(run('npm-ci', 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']));
  else results.push({ label: 'npm-ci', command: 'npm ci [satisfied by CI bootstrap]', status: 'PASS', exitCode: 0, startedAt: now(), completedAt: now(), stdout: '', stderr: '' });
  if (results[0].status === 'PASS') results.push(run('typescript', 'npx', ['tsc', '--noEmit', '--pretty', 'false']));
  if (results.every((r) => r.status === 'PASS')) results.push(run('build', 'npm', ['run', 'build']));
  if (results.every((r) => r.status === 'PASS')) results.push(run('dist', 'node', ['-e', "const fs=require('node:fs'); for (const p of ['dist','dist/index.html']) if (!fs.existsSync(p)) throw new Error('Missing build output: '+p); console.log('Build output verified')"]));
  return writeGateReport('build', results, results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
}

function browserGate() {
  const result = run('playwright', 'npx', ['playwright', 'test', '--project=chromium', '--project=firefox', '--project=webkit'], {
    CI: 'true',
    PLAYWRIGHT_REUSE_SERVER: 'false',
  });
  return writeGateReport('browser', [result], result.status);
}

const executeGate = (name) => name === 'static' ? staticGate() : name === 'build' ? buildGate() : browserGate();
const targetGates = gate ? [gate] : GATES;
const reports = [];
for (const name of targetGates) {
  const report = executeGate(name);
  reports.push(report);
  if (mode === 'certification' && report.status !== 'PASS') break;
}

const overallStatus = reports.length === targetGates.length && reports.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
const rootCauses = [...new Set(reports.map((r) => r.rootCauseId).filter(Boolean))];
const overall = {
  version: 1,
  mode,
  sha: sha(),
  status: overallStatus,
  gatesExpected: targetGates.length,
  gatesExecuted: reports.length,
  rootCauses,
  completedAt: now(),
  gates: reports.map((r) => ({ gate: r.gate, status: r.status, rootCauseId: r.rootCauseId })),
  repro: gate ? `npm run test:${gate}` : mode === 'diagnose' ? 'npm run test:diagnose' : 'npm test',
};
writeFileSync(resolve(DIAG_DIR, 'report.json'), `${JSON.stringify(overall, null, 2)}\n`);
const markdown = [
  `# CI Report`,
  ``,
  `STATUS: ${overallStatus}`,
  `SHA: ${overall.sha}`,
  `MODE: ${mode}`,
  ``,
  `ROOT CAUSES: ${rootCauses.length ? rootCauses.join(', ') : 'NONE'}`,
  ``,
  ...reports.map((r) => `- ${r.gate}: ${r.status}${r.rootCauseId ? ` (${r.rootCauseId})` : ''}`),
  ``,
  `REPRO: ${overall.repro}`,
  ``,
];
writeFileSync(resolve(DIAG_DIR, 'report.md'), markdown.join('\n'));
console.log(JSON.stringify(overall, null, 2));
process.exit(overallStatus === 'PASS' ? 0 : 1);
