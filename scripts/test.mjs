#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIR, { recursive: true });
const args = process.argv.slice(2);
const requestedGate = args.find((arg) => arg.startsWith('--gate='))?.slice(7) ?? null;
const mode = args.find((arg) => arg.startsWith('--mode='))?.slice(7) ?? 'certification';
const ALLOWED_MODES = ['certification', 'diagnose'];
const GATES = ['static', 'build', 'browser'];
const PLAN_PATH = resolve(ROOT, 'scripts/ci/test-plan.json');
const TEST_PLAN = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const PLAN_SHA256 = createHash('sha256').update(readFileSync(PLAN_PATH)).digest('hex');
const MAX_CONCURRENCY = Number(TEST_PLAN.execution?.maxConcurrency ?? 1);
if (!ALLOWED_MODES.includes(mode) || (requestedGate && !GATES.includes(requestedGate))) process.exit(2);
if (!Number.isInteger(MAX_CONCURRENCY) || MAX_CONCURRENCY < 1 || MAX_CONCURRENCY > 32) {
  console.error(`Invalid test-plan maxConcurrency: ${TEST_PLAN.execution?.maxConcurrency}`);
  process.exit(2);
}
const now = () => new Date().toISOString();
const git = (gitArgs) => { const result = spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }); return result.status === 0 ? result.stdout.trim() : 'UNKNOWN'; };
const sha = () => git(['rev-parse', 'HEAD']);
const rootCauses = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));
const runNode = (script) => spawnSync(process.execPath, [script], { cwd: ROOT, env: process.env, encoding: 'utf8' });
const CHECKS = Object.fromEntries(GATES.map((gate) => [gate, TEST_PLAN.gates?.[gate]?.checks ?? []]));
const EXPECTED = Object.fromEntries(GATES.map((gate) => [gate, Number(TEST_PLAN.gates?.[gate]?.expected ?? CHECKS[gate].length)]));
for (const gate of GATES) {
  if (CHECKS[gate].length !== EXPECTED[gate]) {
    console.error(`TEST PLAN DRIFT: ${gate} expected ${EXPECTED[gate]}, matrix defines ${CHECKS[gate].length}`);
    process.exit(1);
  }
  const ids = CHECKS[gate].map((check) => check.id);
  if (new Set(ids).size !== ids.length) {
    console.error(`TEST PLAN DRIFT: duplicate check id in ${gate}`);
    process.exit(1);
  }
}
const allChecks = GATES.flatMap((gate) => CHECKS[gate].map((check) => ({ gate, ...check })));
const allIds = new Set(allChecks.map((check) => check.id));
for (const check of allChecks) {
  for (const dependency of check.dependencies ?? []) {
    if (!allIds.has(dependency)) {
      console.error(`TEST PLAN DRIFT: ${check.id} depends on unknown check ${dependency}`);
      process.exit(1);
    }
  }
  if (!Array.isArray(check.coverage) || check.coverage.length === 0) {
    console.error(`TEST PLAN DRIFT: ${check.id} has no coverage mapping`);
    process.exit(1);
  }
}
const coverageUsage = new Map();
for (const check of allChecks) for (const coverageId of check.coverage) coverageUsage.set(coverageId, [...(coverageUsage.get(coverageId) ?? []), check.id]);
const duplicateCoverage = [...coverageUsage.entries()].filter(([, owners]) => owners.length > 1).map(([coverageId, owners]) => ({ coverageId, owners }));
const declaredCoverage = Object.keys(TEST_PLAN.coverage ?? {});
const uncoveredCoverage = declaredCoverage.filter((coverageId) => !coverageUsage.has(coverageId));
function normalize(output) { const ansi = new RegExp(`${String.fromCharCode(27)}\\\\[[0-?]*[ -/]*[@-~]`, 'g'); return String(output ?? '').replace(ansi, '').replace(/https?:\\/\\/[^\\s]+/g, '<URL>').replace(/[A-Za-z]:\\\\[^\\s]+/g, '<PATH>').replace(/\\/(?:[^\\s/]+\\/){2,}[^\\s]+/g, '<PATH>').replace(/[0-9a-f]{7,40}/gi, '<SHA>').replace(/\\d+(?:\\.\\d+)?/g, '#').replace(/\\s+/g, ' ').trim(); }
function signature(check) { return [...new Set(String(check.output ?? '').split(/\\r?\\n/).map(normalize).filter((line) => /error|failed|failure|cannot|not assignable|not found|expected|received|timeout|exception|assert|locale|route|canonical|hreflang|playwright|chromium|firefox|webkit/i.test(line)).filter(Boolean))].sort().slice(0, 40).join(' ').slice(0, 5000); }
const fallback = [
  ['RC-DEPENDENCY-001', /cannot find module|npm err|npm ci|lockfile|package-lock|ERESOLVE/i],
  ['RC-TYPE-001', /TS\\d+|Type error|not assignable|cannot find name/i],
  ['RC-I18N-001', /translation|locale|language|English leakage|localized/i],
  ['RC-SEO-001', /canonical|hreflang|robots|sitemap|seo/i],
  ['RC-ROUTER-001', /route|404|not found|path resolver/i],
  ['RC-BUILD-001', /build failed|vite.*error|rollup|esbuild/i],
];
function classify(gateName, check, declared) { if (check.status === 'PASS') return null; if (declared && rootCauses[declared]) return declared; for (const [id, pattern] of fallback) if (pattern.test(check.output)) return id; return gateName === 'browser' ? 'RC-BROWSER-001' : 'RC-UNKNOWN-001'; }
function enrich(gateName, check) { const id = classify(gateName, check, check.rootCause); if (check.status === 'PASS') return { ...check, rootCauseId: null, fingerprint: null, repro: null, error: null }; const fingerprint = `FPR-${createHash('sha256').update([id, gateName, check.label, signature(check)].join('\\n')).digest('hex').slice(0, 12).toUpperCase()}`; return { ...check, rootCauseId: id, fingerprint, repro: gateName === 'browser' ? `npx playwright test --project=${check.label}` : [check.command, ...(check.args ?? [])].join(' '), error: { category: rootCauses[id]?.category ?? 'UNKNOWN', normalized: normalize(check.output).slice(-4000) } }; }
function execute(check, env = {}) { return new Promise((resolveResult) => { const startedAt = now(); const child = spawn(check.command, check.args ?? [], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { const text = chunk.toString(); stdout += text; process.stdout.write(text); }); child.stderr.on('data', (chunk) => { const text = chunk.toString(); stderr += text; process.stderr.write(text); }); child.on('error', (error) => resolveResult({ id: check.id, label: check.label, command: [check.command, ...(check.args ?? [])].join(' '), status: 'FAIL', exitCode: 1, startedAt, completedAt: now(), output: `${stdout}\\n${stderr}\\n${error.message}`.slice(-16000) })); child.on('close', (code, signal) => resolveResult({ id: check.id, label: check.label, command: [check.command, ...(check.args ?? [])].join(' '), status: code === 0 ? 'PASS' : 'FAIL', exitCode: code ?? 1, signal: signal ?? null, startedAt, completedAt: now(), output: `${stdout}\\n${stderr}`.slice(-16000) })); }); }
async function executeMatrix(gateName, checks) {
  const results = new Map();
  const pending = new Map(checks.map((check) => [check.id, check]));
  const active = new Set();
  while (pending.size || active.size) {
    const runnable = [...pending.values()].filter((check) => (check.dependencies ?? []).every((dependency) => results.has(dependency))).slice(0, Math.max(0, MAX_CONCURRENCY - active.size));
    for (const check of runnable) {
      pending.delete(check.id);
      const promise = execute(check).then((result) => { results.set(check.id, enrich(gateName, { ...result, rootCause: check.rootCause, coverage: check.coverage, cost: check.cost, dependencies: check.dependencies ?? [] })); active.delete(promise); });
      active.add(promise);
    }
    if (active.size === 0 && pending.size) {
      console.error(`TEST PLAN DEADLOCK: ${gateName} has unresolved dependency cycle or invalid ordering.`);
      process.exit(1);
    }
    if (active.size) await Promise.race(active);
  }
  return checks.map((check) => results.get(check.id));
}
function buildReport(gateName, checks) { const failures = checks.filter((check) => check.status === 'FAIL'); return { version: 6, schema: 'flixo-gate-report/v6', sha: sha(), gate: gateName.toUpperCase(), mode, status: failures.length === 0 && checks.length === EXPECTED[gateName] ? 'PASS' : 'FAIL', failures: failures.length, checksExpected: EXPECTED[gateName], checksExecuted: checks.length, rootCauses: [...new Set(failures.map((check) => check.rootCauseId).filter(Boolean))], coverage: [...new Set(checks.flatMap((check) => check.coverage ?? []))], completedAt: now(), checks }; }
async function waitForServer(url) { for (let attempt = 0; attempt < 40; attempt += 1) { try { const response = await fetch(url); if (response.ok) return; } catch {} await new Promise((sleep) => setTimeout(sleep, 500)); } throw new Error(`Preview server did not become ready: ${url}`); }
async function browserGate() { const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '3000'], { cwd: ROOT, env: { ...process.env, CI: 'true' }, stdio: 'ignore' }); try { await waitForServer('http://127.0.0.1:3000'); const checks = TEST_PLAN.gates.browser.checks; const results = await executeMatrix('browser', checks.map((check) => ({ ...check, command: check.command, args: check.args }))); return buildReport('browser', results); } finally { server.kill('SIGTERM'); } }
function overall(reports, target) { const failures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL')); const roots = [...new Set(failures.map((check) => check.rootCauseId).filter(Boolean))]; const coverage = [...new Set(reports.flatMap((report) => report.coverage ?? []))]; const expectedChecks = target.reduce((sum, gateName) => sum + EXPECTED[gateName], 0); const executedChecks = reports.reduce((sum, report) => sum + report.checksExecuted, 0); const pass = reports.length === target.length && reports.every((report) => report.status === 'PASS' && report.checksExpected === report.checksExecuted) && failures.length === 0; const output = { version: 6, schema: 'flixo-ci-report/v6', mode, sha: sha(), testPlanSha256: PLAN_SHA256, status: pass ? 'PASS' : 'FAIL', gatesExpected: target.length, gatesExecuted: reports.length, checksExpected: expectedChecks, checksExecuted: executedChecks, rootCauses: roots, coverage, matrix: { declaredCoverage: declaredCoverage.length, coveredCoverage: coverage.length, duplicateCoverage, uncoveredCoverage }, firstFailure: failures[0] ? { rootCauseId: failures[0].rootCauseId, fingerprint: failures[0].fingerprint, repro: failures[0].repro } : null, completedAt: now(), reports }; writeFileSync(resolve(DIR, 'canonical-result.json'), `${JSON.stringify(output, null, 2)}\\n`); writeFileSync(resolve(DIR, 'report.json'), `${JSON.stringify(output, null, 2)}\\n`); writeFileSync(resolve(DIR, 'failures.json'), `${JSON.stringify(failures, null, 2)}\\n`); return output; }

const currentSha = sha();
if (process.env.EXPECTED_SHA && process.env.EXPECTED_SHA !== currentSha) { console.error(`EXACT SHA VIOLATION: expected ${process.env.EXPECTED_SHA}, executed ${currentSha}`); process.exit(1); }
if (!existsSync(resolve(ROOT, 'node_modules/.package-lock.json'))) { console.error('DEPENDENCY STATE VIOLATION: npm ci must complete before certification runner.'); process.exit(1); }
const context = runNode('scripts/ci/capture-execution-context.mjs'); process.stdout.write(context.stdout ?? ''); process.stderr.write(context.stderr ?? ''); if ((context.status ?? 1) !== 0) process.exit(context.status ?? 1);
const target = requestedGate ? [requestedGate] : GATES;
const reports = [];
for (const gateName of target) {
  if (gateName === 'browser') {
    const buildReport = reports.find((report) => report.gate === 'BUILD');
    if (target.length > 1 && buildReport && buildReport.status !== 'PASS') reports.push({ version: 6, schema: 'flixo-gate-report/v6', sha: sha(), gate: 'BROWSER', mode, status: 'BLOCKED', failures: 0, checksExpected: EXPECTED.browser, checksExecuted: 0, rootCauses: ['RC-BUILD-001'], coverage: [], completedAt: now(), checks: [] });
    else reports.push(await browserGate());
  } else reports.push(buildReport(gateName, await executeMatrix(gateName, CHECKS[gate])));
  if (mode === 'certification' && reports.at(-1).status !== 'PASS' && gateName !== 'static') break;
}
const result = overall(reports, target);
for (const script of ['scripts/ci/normalize-reproduction.mjs', 'scripts/ci/collect-failure-evidence.mjs', 'scripts/ci/record-repair-cycle.mjs', 'scripts/ci/detect-shared-root-candidates.mjs']) { const diagnostic = runNode(script); process.stdout.write(diagnostic.stdout ?? ''); process.stderr.write(diagnostic.stderr ?? ''); if ((diagnostic.status ?? 1) !== 0) console.error(`Supporting diagnostic ${script} returned ${diagnostic.status ?? 1}.`); }
process.exit(result.status === 'PASS' ? 0 : 1);
