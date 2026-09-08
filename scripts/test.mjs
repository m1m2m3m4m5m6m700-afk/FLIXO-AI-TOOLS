#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reduceCheckResults } from './ci/result-state.mjs';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const requested = args.find((a) => a.startsWith('--gate='))?.slice(7) ?? null;
const mode = args.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'certification';
const PLAN_PATH = resolve(ROOT, 'scripts/ci/test-plan.json');
const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const gates = ['static', 'build', 'browser'];
if (!['certification', 'diagnose'].includes(mode) || (requested && !gates.includes(requested))) process.exit(2);
const planSha = createHash('sha256').update(readFileSync(PLAN_PATH)).digest('hex');
const max = Number(plan.execution?.maxConcurrency ?? 1);
if (!Number.isInteger(max) || max < 1 || max > 32) process.exit(2);
const now = () => new Date().toISOString();
const git = (a) => {
  const r = spawnSync('git', a, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(String(r.stderr || 'git command failed').trim());
  return r;
};
const exec = (check) => new Promise((resolveResult) => {
  const started = now();
  const child = spawn(check.command, check.args ?? [], { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', (d) => { const s = d.toString(); out += s; process.stdout.write(s); });
  child.stderr.on('data', (d) => { const s = d.toString(); err += s; process.stderr.write(s); });
  child.on('error', (e) => resolveResult({ ...check, status: 'FAIL', exitCode: 1, startedAt: started, completedAt: now(), output: `${out}\n${err}\n${e.message}`.slice(-24000) }));
  child.on('close', (code, signal) => resolveResult({ ...check, status: code === 0 ? 'PASS' : 'FAIL', exitCode: code ?? 1, signal: signal ?? null, startedAt: started, completedAt: now(), output: `${out}\n${err}`.slice(-24000) }));
});
const rootFor = (gate, check) => {
  if (check.status === 'PASS') return null;
  const o = check.output ?? '';
  const lines = o.split(/\r?\n/);
  const marker = 'RUNTIME_EVIDENCE=';
  const hit = lines.filter((l) => l.includes(marker)).at(-1);
  if (hit) {
    try {
      const e = JSON.parse(hit.slice(hit.indexOf(marker) + marker.length));
      if ((e.pageErrors?.length ?? 0) || (e.consoleErrors?.length ?? 0)) return 'RC-RUNTIME-001';
      if ((e.requestFailures?.length ?? 0) || (e.failedResponses?.length ?? 0)) return 'RC-NETWORK-001';
    } catch { /* malformed runtime evidence is handled by the evidence validator */ }
  }
  if (/npm ci|lockfile|package-lock|ERESOLVE|Missing: @rollup/i.test(o)) return 'RC-DEPENDENCY-001';
  if (/TS\d+|not assignable|cannot find name/i.test(o)) return 'RC-TYPE-001';
  if (/canonical|hreflang|sitemap|seo/i.test(o)) return 'RC-SEO-001';
  if (/locale|translation|language|localized/i.test(o)) return 'RC-I18N-001';
  if (/build failed|vite.*error|rollup|esbuild/i.test(o)) return 'RC-BUILD-001';
  return check.rootCause ?? (gate === 'browser' ? 'RC-BROWSER-001' : 'RC-UNKNOWN-001');
};
function planIntegrity() {
  const declared = new Set(Object.keys(plan.assertions ?? {}));
  const owners = new Map();
  const duplicateAssertions = [];
  const duplicateCheckIds = [];
  const referenced = new Set();
  const unknownAssertions = [];
  const unknownCoverage = [];
  const seenChecks = new Set();
  const seenCoverage = new Map();
  for (const gate of gates) {
    for (const check of plan.gates?.[gate]?.checks ?? []) {
      if (!check.id || seenChecks.has(check.id)) duplicateCheckIds.push(check.id ?? '<missing-id>');
      seenChecks.add(check.id);
      for (const assertion of check.assertions ?? []) {
        if (owners.has(assertion)) duplicateAssertions.push({ assertion, owners: [owners.get(assertion), check.id] });
        else owners.set(assertion, check.id);
        referenced.add(assertion);
      }
      for (const coverage of check.coverage ?? []) {
        if (!plan.coverage?.[coverage]) unknownCoverage.push({ check: check.id, coverage });
        else if (!seenCoverage.has(coverage)) seenCoverage.set(coverage, check.id);
      }
    }
  }
  for (const id of referenced) if (!declared.has(id)) unknownAssertions.push(id);
  const uncoveredAssertions = [...declared].filter((id) => !referenced.has(id));
  const uncoveredCoverage = Object.keys(plan.coverage ?? {}).filter((id) => !seenCoverage.has(id));
  return { duplicateAssertions, duplicateCheckIds, uncoveredAssertions, unknownAssertions, unknownCoverage, uncoveredCoverage };
}
function executionGraph(name) {
  const checks = plan.gates?.[name]?.checks ?? [];
  const byAssertion = new Map();
  for (const check of checks) for (const assertion of check.assertions ?? []) byAssertion.set(assertion, check.id);
  const registryPath = plan.assertionRegistry ? resolve(ROOT, plan.assertionRegistry) : null;
  const registry = registryPath ? JSON.parse(readFileSync(registryPath, 'utf8')) : { assertions: {} };
  const deps = new Map();
  const graphErrors = [];
  for (const check of checks) {
    const dependencies = new Set();
    for (const assertion of check.assertions ?? []) {
      for (const dependency of registry.assertions?.[assertion]?.dependencies ?? []) {
        const owner = byAssertion.get(dependency);
        if (owner && owner !== check.id) dependencies.add(owner);
      }
    }
    deps.set(check.id, [...dependencies]);
  }
  const state = new Map(checks.map((c) => [c.id, 0]));
  const stack = [];
  const visit = (id) => {
    const current = state.get(id);
    if (current === 1) {
      const start = stack.indexOf(id);
      graphErrors.push(`DEPENDENCY_CYCLE: ${[...stack.slice(start), id].join(' -> ')}`);
      return;
    }
    if (current === 2) return;
    state.set(id, 1); stack.push(id);
    for (const dependency of deps.get(id) ?? []) if (state.has(dependency)) visit(dependency);
    stack.pop(); state.set(id, 2);
  };
  for (const check of checks) visit(check.id);
  return { checks, deps, graphErrors };
}
async function runGate(name) {
  const checks = plan.gates?.[name]?.checks ?? [];
  const expected = Number(plan.gates?.[name]?.expected ?? checks.length);
  const graph = executionGraph(name);
  const results = [];
  const resultById = new Map();
  const pending = new Map(checks.map((c) => [c.id, c]));
  if (graph.graphErrors.length) {
    for (const check of checks) {
      const r = { ...check, gate: name, status: 'FAIL', exitCode: 1, startedAt: now(), completedAt: now(), rootCauseId: 'RC-CI-CONTRACT-001', output: graph.graphErrors.join('\n') };
      r.fingerprint = `FPR-${createHash('sha256').update([r.rootCauseId, r.gate, r.label, r.output].join('\n')).digest('hex').slice(0, 12).toUpperCase()}`;
      results.push(r); resultById.set(check.id, r);
    }
  } else {
    while (pending.size) {
      const blocked = [...pending.values()].filter((check) => graph.deps.get(check.id).some((dep) => ['FAIL', 'BLOCKED', 'CANCELLED', 'NOT_EXECUTED'].includes(resultById.get(dep)?.status)));
      for (const check of blocked) {
        const blockers = graph.deps.get(check.id).filter((dep) => ['FAIL', 'BLOCKED', 'CANCELLED', 'NOT_EXECUTED'].includes(resultById.get(dep)?.status));
        const r = { ...check, gate: name, status: 'BLOCKED', exitCode: null, startedAt: now(), completedAt: now(), blockedBy: blockers, rootCauseId: null, output: `BLOCKED_BY=${blockers.join(',')}` };
        results.push(r); resultById.set(r.id, r); pending.delete(r.id);
      }
      const ready = [...pending.values()].filter((check) => graph.deps.get(check.id).every((dep) => resultById.get(dep)?.status === 'PASS'));
      if (!ready.length) {
        if (pending.size) throw new Error(`Execution graph stalled in ${name}: ${[...pending.keys()].join(',')}`);
        break;
      }
      for (let i = 0; i < ready.length; i += max) {
        const batch = ready.slice(i, i + max).filter((c) => pending.has(c.id));
        if (!batch.length) continue;
        const done = await Promise.all(batch.map((c) => exec({ ...c, gate: name })));
        for (const r of done) {
          r.rootCauseId = rootFor(name, r);
          if (r.status === 'FAIL') r.fingerprint = `FPR-${createHash('sha256').update([r.rootCauseId, r.gate, r.label, (r.output ?? '').replace(/\s+/g, ' ').slice(-4000)].join('\n')).digest('hex').slice(0, 12).toUpperCase()}`;
          else r.fingerprint = null;
          results.push(r); resultById.set(r.id, r); pending.delete(r.id);
        }
      }
    }
  }
  const reduced = reduceCheckResults(results, expected);
  const failed = results.filter((r) => r.status === 'FAIL');
  const blocked = results.filter((r) => r.status === 'BLOCKED');
  const report = {
    version: 10,
    schema: 'flixo-gate-report/v10',
    evidenceClass: 'PRIMARY_EXECUTION',
    sha: git(['rev-parse', 'HEAD']).stdout.trim(),
    gate: name.toUpperCase(),
    mode,
    status: reduced.status,
    stateCounts: reduced.counts,
    failures: failed.length,
    blocked: blocked.length,
    checksExpected: expected,
    checksExecuted: reduced.executed,
    rootCauses: [...new Set(failed.map((r) => r.rootCauseId).filter(Boolean))],
    coverage: [...new Set(results.flatMap((r) => r.coverage ?? []))],
    assertions: [...new Set(results.flatMap((r) => r.assertions ?? []))],
    completedAt: now(),
    checks: results,
  };
  writeFileSync(resolve(OUT, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const targets = requested ? [requested] : gates;
const reports = [];
for (const g of targets) {
  if (reports.length && reports.at(-1).status !== 'PASS') break;
  reports.push(await runGate(g));
}
const sha = git(['rev-parse', 'HEAD']).stdout.trim();
const allChecks = reports.flatMap((r) => r.checks);
const expected = targets.reduce((n, g) => n + Number(plan.gates?.[g]?.expected ?? 0), 0);
const reduced = reduceCheckResults(allChecks, expected);
const integrity = planIntegrity();
const integrityPass = Object.values(integrity).every((v) => Array.isArray(v) && v.length === 0);
const independentFailures = allChecks.filter((f) => f.status === 'FAIL' && !f.derivedFrom && !(f.blockedBy?.length));
const derivedFailures = allChecks.filter((f) => f.status === 'FAIL' && (f.derivedFrom || f.blockedBy?.length));
const rootCauses = [...new Set(independentFailures.map((f) => f.rootCauseId).filter(Boolean))];
const rootCauseGroups = Object.fromEntries(rootCauses.map((rc) => [rc, independentFailures.filter((f) => f.rootCauseId === rc).map((f) => f.id)]));
const canonical = {
  version: 11,
  schema: 'flixo-ci-report/v9',
  evidenceClass: 'PRIMARY_EXECUTION',
  mode,
  sha,
  testPlanSha256: planSha,
  status: reduced.status === 'PASS' && reports.length === targets.length && integrityPass ? 'PASS' : 'FAIL',
  executionStates: Object.keys(reduced.counts),
  stateCounts: reduced.counts,
  gatesExpected: targets.length,
  gatesExecuted: reports.length,
  checksExpected: expected,
  checksExecuted: reduced.executed,
  blockedCount: reduced.counts.BLOCKED,
  rootCauses,
  rootCauseGroups,
  independentRootCauseCount: rootCauses.length,
  derivedFailureCount: derivedFailures.length,
  assertions: integrity,
  coverage: {},
  matrix: { maxConcurrency: max, gateDependencies: plan.gateDependencies ?? {}, assertionRegistry: plan.assertionRegistry ?? null },
  reports,
};
writeFileSync(resolve(OUT, 'canonical-result.json'), `${JSON.stringify(canonical, null, 2)}\n`);
writeFileSync(resolve(OUT, 'report.json'), `${JSON.stringify(canonical, null, 2)}\n`);
console.log(`CANONICAL_STATUS=${canonical.status}`);
console.log(`CANONICAL_SHA=${sha}`);
if (canonical.status !== 'PASS') process.exitCode = 1;
