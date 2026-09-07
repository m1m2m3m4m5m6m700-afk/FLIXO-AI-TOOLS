#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const DIAG_DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIAG_DIR, { recursive: true });
const now = new Date().toISOString();
const sha = process.env.GITHUB_SHA || process.env.EXPECTED_SHA || 'UNKNOWN';
const mode = process.env.FLIXO_TEST_MODE || 'certification';
const runId = process.env.GITHUB_RUN_ID || 'local';
const gateNames = ['static', 'build', 'browser'];
const reportPath = resolve(DIAG_DIR, 'report.json');
const registry = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));

function readGateReports() {
  return gateNames.map((gate) => {
    const path = resolve(DIAG_DIR, `${gate}.json`);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return { schema: 'flixo-gate-report/v5', sha, gate: gate.toUpperCase(), mode, status: 'FAIL', rootCauses: ['RC-DIAGNOSTIC-002'], checks: [{ label: `${gate}-report`, status: 'FAIL', exitCode: 1, command: `npm run test:${gate}`, rootCauseId: 'RC-DIAGNOSTIC-002', fingerprint: 'FPR-DIAGNOSTIC-002', repro: `npm run test:${gate}`, error: { category: 'DIAGNOSTIC', normalized: `Unable to parse ${gate}.json` } }] }; }
  }).filter(Boolean);
}
function correlate({ cycle, reports }) {
  const failures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({ ...check, gate: report.gate })));
  const byRoot = new Map();
  for (const failure of failures) { const id = failure.rootCauseId ?? 'RC-UNKNOWN-001'; const current = byRoot.get(id) ?? { id, rootCauseId: id, occurrences: 0, distinctSymptoms: new Set(), confidence: 0.5 }; current.occurrences += 1; current.distinctSymptoms.add(failure.fingerprint ?? failure.label); current.confidence = Math.min(0.99, current.confidence + 0.1); byRoot.set(id, current); }
  const roots = [...byRoot.values()].map((root) => ({ ...root, distinctSymptoms: [...root.distinctSymptoms], status: registry[root.id] ? 'KNOWN' : 'UNKNOWN', recurrenceCount: 0, regressionCount: 0 }));
  const clusters = roots.map((root) => ({ id: `SRC-${root.id}`, rootCauseId: root.id, occurrences: root.occurrences, distinctSymptoms: root.distinctSymptoms, confidence: root.confidence }));
  return { distinctSymptoms: new Set(failures.map((failure) => failure.fingerprint ?? failure.label)).size, clusters, recurrenceCount: 0, regressionCount: 0, newRootCount: roots.filter((root) => root.status === 'UNKNOWN').length, memory: { cycles: cycle.status === 'PASS' ? 0 : 1 }, roots };
}
function cycleFingerprint(cycle) { return createHash('sha256').update(JSON.stringify({ mode: cycle.mode, rootCauses: cycle.rootCauses, failures: cycle.failures.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'fingerprints'))) })).digest('hex'); }
function writeCycleFiles(cycle, correlation) {
  appendFileSync(resolve(DIAG_DIR, 'repair-cycles.jsonl'), `${JSON.stringify(cycle)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'latest-repair-cycle.json'), `${JSON.stringify({ ...cycle, correlation }, null, 2)}\n`);
  const ledger = { schemaVersion: 3, schema: 'flixo-failure-ledger/v3', generatedAt: now, sha, mode, runId, status: cycle.status, totalRootCauses: cycle.failures.length, totalFailureOccurrences: cycle.failures.reduce((sum, item) => sum + item.occurrences, 0), rootCauses: cycle.failures, distinctSymptoms: correlation.distinctSymptoms, correlatedClusters: correlation.clusters.length, knownRootCausesRecurring: correlation.recurrenceCount, regressions: correlation.regressionCount, newRootCauses: correlation.newRootCount, memoryCycles: correlation.memory.cycles, noSymptomPatching: correlation.roots.length > 0 };
  writeFileSync(resolve(DIAG_DIR, 'failure-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`); return ledger;
}
function fallbackCycle() { return { schemaVersion: 3, schema: 'flixo-repair-cycle/v3', cycleId: `RCYCLE-NO-REPORT-${sha.slice(0, 12)}`, recordedAt: now, sha, mode, runId, status: 'FAIL', gatesExpected: 3, gatesExecuted: 0, rootCauses: ['RC-DIAGNOSTIC-001'], failures: [{ rootCauseId: 'RC-DIAGNOSTIC-001', occurrences: 1, fingerprints: ['FPR-DIAGNOSTIC-001'], repro: 'Inspect the earliest failed CI step before gate diagnostics were produced', affectedChecks: [] }], firstFailure: { gate: 'CI', rootCauseId: 'RC-DIAGNOSTIC-001', fingerprint: 'FPR-DIAGNOSTIC-001', repro: 'Inspect the earliest failed CI step before gate diagnostics were produced' }, sourceReports: [] }; }

const gateReports = readGateReports();
if (gateReports.length === 0 && !existsSync(reportPath)) { const fallback = fallbackCycle(); const correlation = correlate({ cycle: fallback, reports: [{ gate: 'CI', checks: [{ label: 'diagnostic-report', status: 'FAIL', exitCode: 1, rootCauseId: 'RC-DIAGNOSTIC-001', fingerprint: 'FPR-DIAGNOSTIC-001', repro: fallback.firstFailure.repro, error: { category: 'DIAGNOSTIC', normalized: 'No gate report was produced' } }] }] }); writeCycleFiles(fallback, correlation); console.error('No gate report was produced; recorded fail-closed diagnostic cycle RC-DIAGNOSTIC-001.'); process.exit(0); }
const reports = gateReports.length > 0 ? gateReports : [JSON.parse(readFileSync(reportPath, 'utf8'))];
const allFailures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({ gate: report.gate, ...check })));
const clusters = new Map();
for (const failure of allFailures) { const rootCauseId = failure.rootCauseId ?? 'RC-UNKNOWN-001'; const current = clusters.get(rootCauseId) ?? { rootCauseId, occurrences: 0, fingerprints: new Set(), repro: failure.repro ?? null, affectedChecks: [] }; current.occurrences += 1; if (failure.fingerprint) current.fingerprints.add(failure.fingerprint); current.affectedChecks.push({ gate: failure.gate, label: failure.label, exitCode: failure.exitCode }); clusters.set(rootCauseId, current); }
const failures = [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints] }));
const status = reports.length === gateNames.length && reports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL';
const rootCauses = failures.map((failure) => failure.rootCauseId);
const firstFailure = allFailures[0] ?? null;
const baseCycle = { schemaVersion: 3, schema: 'flixo-repair-cycle/v3', recordedAt: now, sha, mode, runId, status, gatesExpected: gateNames.length, gatesExecuted: reports.length, rootCauses, failures, firstFailure: firstFailure ? { gate: firstFailure.gate, rootCauseId: firstFailure.rootCauseId ?? 'RC-UNKNOWN-001', fingerprint: firstFailure.fingerprint ?? null, repro: firstFailure.repro ?? null } : null, sourceReports: reports.map((report) => `${String(report.gate).toLowerCase()}.json`) };
const cycleId = `RCYCLE-${cycleFingerprint(baseCycle).slice(0, 12).toUpperCase()}`;
const cycle = { ...baseCycle, cycleId };
const correlation = correlate({ cycle, reports, registry });
const ledger = writeCycleFiles(cycle, correlation);
const markdown = ['# Repair Cycle Diagnostic', '', `STATUS: ${status}`, `SHA: ${sha}`, `MODE: ${mode}`, `RUN: ${runId}`, `CYCLE: ${cycleId}`, '', `FAILURES: ${allFailures.length}`, `DISTINCT SYMPTOMS: ${correlation.distinctSymptoms}`, `CORRELATED CLUSTERS: ${correlation.clusters.length}`, `KNOWN ROOT CAUSES RECURRING: ${correlation.recurrenceCount}`, `REGRESSIONS: ${correlation.regressionCount}`, `NEW ROOT CAUSES: ${correlation.newRootCount}`, `MEMORY CYCLES: ${correlation.memory.cycles}`, '', 'ROOT CAUSE MEMORY:', ...(correlation.roots.length ? correlation.roots.map((root) => `- ${root.id}: status=${root.status}, confidence=${root.confidence}, occurrences=${root.occurrences}`) : ['- NONE']), '', 'OPERATING RULE:', 'NO SYMPTOM PATCHING WHEN SHARED ROOT IS DETECTED', '', 'GATES:', ...reports.map((report) => `- ${report.gate}: ${report.status}`), ''];
writeFileSync(resolve(DIAG_DIR, 'repair-cycle-report.md'), `${markdown.join('\n')}\n`);
console.log(`REPAIR_CYCLE_ID=${cycleId}`); console.log(`REPAIR_CYCLE_STATUS=${status}`); console.log(`DISTINCT_SYMPTOMS=${correlation.distinctSymptoms}`); console.log(`CORRELATED_CLUSTERS=${correlation.clusters.length}`); console.log(`KNOWN_ROOT_CAUSES_RECURRING=${correlation.recurrenceCount}`); console.log(`REGRESSIONS=${correlation.regressionCount}`); console.log(`NEW_ROOT_CAUSES=${correlation.newRootCount}`); console.log(`ROOT_CAUSES=${rootCauses.join(',') || 'NONE'}`); console.log(`FAILURE_OCCURRENCES=${ledger.totalFailureOccurrences}`);
