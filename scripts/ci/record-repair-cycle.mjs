#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIR, { recursive: true });
const now = new Date().toISOString();
const sha = process.env.GITHUB_SHA || process.env.EXPECTED_SHA || 'UNKNOWN';
const mode = process.env.FLIXO_TEST_MODE || 'certification';
const runId = process.env.GITHUB_RUN_ID || 'local';
const registry = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));
const canonicalPath = resolve(DIR, 'canonical-result.json');
const canonical = existsSync(canonicalPath) ? JSON.parse(readFileSync(canonicalPath, 'utf8')) : null;
const cycleHistoryPath = resolve(DIR, 'repair-cycles.jsonl');
const previousCycles = existsSync(cycleHistoryPath)
  ? readFileSync(cycleHistoryPath, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } })
  : [];
const reports = canonical?.reports ?? ['static', 'build', 'browser'].map((gate) => { const path = resolve(DIR, `${gate}.json`); return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; }).filter(Boolean);
const allFailures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({ gate: report.gate, ...check })));
const clusters = new Map();
for (const failure of allFailures) {
  const rootCauseId = failure.rootCauseId ?? 'RC-UNKNOWN-001';
  const current = clusters.get(rootCauseId) ?? { rootCauseId, occurrences: 0, fingerprints: new Set(), repro: failure.repro ?? null, affectedChecks: [], symptoms: new Set(), category: registry[rootCauseId]?.category ?? 'UNKNOWN' };
  current.occurrences += 1;
  if (failure.fingerprint) { current.fingerprints.add(failure.fingerprint); current.symptoms.add(failure.fingerprint); }
  current.affectedChecks.push({ gate: failure.gate, label: failure.label, exitCode: failure.exitCode });
  clusters.set(rootCauseId, current);
}
const failures = [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints], symptoms: [...cluster.symptoms], affectedChecks: cluster.affectedChecks }));
const currentRoots = new Set(failures.map((failure) => failure.rootCauseId));
const priorRootSets = previousCycles.map((cycle) => new Set(cycle.rootCauses ?? []));
const recurrenceCount = [...currentRoots].filter((id) => priorRootSets.some((roots) => roots.has(id))).length;
const regressionCount = [...currentRoots].filter((id) => {
  const priorIndex = previousCycles.map((cycle) => cycle.rootCauses ?? []).findLastIndex((roots) => roots.includes(id));
  if (priorIndex < 0) return false;
  return previousCycles.slice(priorIndex + 1).some((cycle) => (cycle.rootCauses ?? []).length === 0 && cycle.status === 'PASS');
}).length;
const status = canonical?.status === 'PASS' && canonical.gatesExecuted === canonical.gatesExpected ? 'PASS' : 'FAIL';
const baseCycle = {
  schemaVersion: 4,
  schema: 'flixo-repair-cycle/v4',
  cycleId: '',
  recordedAt: now,
  sha,
  mode,
  runId,
  status,
  gatesExpected: canonical?.gatesExpected ?? 3,
  gatesExecuted: canonical?.gatesExecuted ?? reports.length,
  checksExpected: canonical?.checksExpected ?? reports.reduce((sum, report) => sum + (report.checksExpected ?? 0), 0),
  checksExecuted: canonical?.checksExecuted ?? reports.reduce((sum, report) => sum + (report.checksExecuted ?? 0), 0),
  rootCauses: failures.map((failure) => failure.rootCauseId),
  failures,
  firstFailure: allFailures[0] ? { gate: allFailures[0].gate, rootCauseId: allFailures[0].rootCauseId ?? 'RC-UNKNOWN-001', fingerprint: allFailures[0].fingerprint ?? null, repro: allFailures[0].repro ?? null } : null,
  sourceArtifact: canonical ? 'canonical-result.json' : 'gate reports',
};
baseCycle.cycleId = `RCYCLE-${createHash('sha256').update(JSON.stringify({ sha, mode, rootCauses: baseCycle.rootCauses, failures })).digest('hex').slice(0, 12).toUpperCase()}`;
const correlation = {
  distinctSymptoms: new Set(allFailures.map((failure) => failure.fingerprint ?? failure.label)).size,
  clusters: failures.map((failure) => ({ id: `SRC-${failure.rootCauseId}`, rootCauseId: failure.rootCauseId, occurrences: failure.occurrences, distinctSymptoms: failure.symptoms, confidence: Math.min(0.99, 0.5 + Math.max(0, failure.occurrences - 1) * 0.1) })),
  recurrenceCount,
  regressionCount,
  newRootCount: failures.filter((failure) => !priorRootSets.some((roots) => roots.has(failure.rootCauseId))).length,
};
const ledger = {
  schemaVersion: 4,
  schema: 'flixo-failure-ledger/v4',
  generatedAt: now,
  sha,
  mode,
  runId,
  status,
  sourceArtifact: canonical ? 'canonical-result.json' : 'gate reports',
  totalRootCauses: failures.length,
  totalFailureOccurrences: failures.reduce((sum, failure) => sum + failure.occurrences, 0),
  rootCauses: failures,
  distinctSymptoms: correlation.distinctSymptoms,
  correlatedClusters: correlation.clusters.length,
  knownRootCausesRecurring: correlation.recurrenceCount,
  regressions: correlation.regressionCount,
  newRootCauses: correlation.newRootCount,
  memoryCycles: previousCycles.length + 1,
  noSymptomPatching: failures.length > 0,
};
appendFileSync(cycleHistoryPath, `${JSON.stringify(baseCycle)}\n`);
writeFileSync(resolve(DIR, 'latest-repair-cycle.json'), `${JSON.stringify({ ...baseCycle, correlation }, null, 2)}\n`);
writeFileSync(resolve(DIR, 'failure-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
const markdown = ['# Repair Cycle Diagnostic', '', `STATUS: ${status}`, `SHA: ${sha}`, `MODE: ${mode}`, `RUN: ${runId}`, `CYCLE: ${baseCycle.cycleId}`, '', `FAILURES: ${allFailures.length}`, `DISTINCT SYMPTOMS: ${correlation.distinctSymptoms}`, `CORRELATED CLUSTERS: ${correlation.clusters.length}`, `KNOWN ROOT CAUSES RECURRING: ${correlation.recurrenceCount}`, `REGRESSIONS: ${correlation.regressionCount}`, `NEW ROOT CAUSES: ${correlation.newRootCount}`, `MEMORY CYCLES: ${ledger.memoryCycles}`, '', 'ROOT CAUSE MEMORY:', ...(failures.length ? failures.map((failure) => `- ${failure.rootCauseId}: status=${registry[failure.rootCauseId] ? 'KNOWN' : 'UNKNOWN'}, occurrences=${failure.occurrences}`) : ['- NONE']), '', 'OPERATING RULE:', 'NO SYMPTOM PATCHING WHEN SHARED ROOT IS DETECTED', '', 'GATES:', ...reports.map((report) => `- ${report.gate}: ${report.status}`), ''];
writeFileSync(resolve(DIR, 'repair-cycle-report.md'), `${markdown.join('\n')}\n`);
console.log(`REPAIR_CYCLE_ID=${baseCycle.cycleId}`);
console.log(`REPAIR_CYCLE_STATUS=${status}`);
console.log(`DISTINCT_SYMPTOMS=${correlation.distinctSymptoms}`);
console.log(`CORRELATED_CLUSTERS=${correlation.clusters.length}`);
console.log(`KNOWN_ROOT_CAUSES_RECURRING=${correlation.recurrenceCount}`);
console.log(`REGRESSIONS=${correlation.regressionCount}`);
console.log(`NEW_ROOT_CAUSES=${correlation.newRootCount}`);
console.log(`ROOT_CAUSES=${baseCycle.rootCauses.join(',') || 'NONE'}`);
console.log(`FAILURE_OCCURRENCES=${ledger.totalFailureOccurrences}`);
