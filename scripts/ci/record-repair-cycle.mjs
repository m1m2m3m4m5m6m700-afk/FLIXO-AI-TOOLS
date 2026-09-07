#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const gateReports = gateNames.map((gate) => {
  const path = resolve(DIAG_DIR, `${gate}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return {
      version: 3,
      schema: 'flixo-gate-report/v3',
      sha,
      gate: gate.toUpperCase(),
      mode,
      status: 'FAIL',
      rootCauses: ['RC-DIAGNOSTIC-002'],
      checks: [{
        label: `${gate}-report`, status: 'FAIL', exitCode: 1,
        command: `npm run test:${gate}`,
        rootCauseId: 'RC-DIAGNOSTIC-002',
        fingerprint: 'FPR-DIAGNOSTIC-002',
        repro: `npm run test:${gate}`,
        error: { category: 'DIAGNOSTIC', normalized: `Unable to parse ${gate}.json` },
      }],
    };
  }
}).filter(Boolean);

function writeCycleFiles(cycle) {
  appendFileSync(resolve(DIAG_DIR, 'repair-cycles.jsonl'), `${JSON.stringify(cycle)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'latest-repair-cycle.json'), `${JSON.stringify(cycle, null, 2)}\n`);
  const ledger = {
    schemaVersion: 2,
    schema: 'flixo-failure-ledger/v2',
    generatedAt: now,
    sha,
    mode,
    runId,
    status: cycle.status,
    totalRootCauses: cycle.failures.length,
    totalFailureOccurrences: cycle.failures.reduce((sum, item) => sum + item.occurrences, 0),
    rootCauses: cycle.failures,
  };
  writeFileSync(resolve(DIAG_DIR, 'failure-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
  return ledger;
}

if (gateReports.length === 0 && !existsSync(reportPath)) {
  const fallback = {
    schemaVersion: 2,
    cycleId: `RCYCLE-NO-REPORT-${sha.slice(0, 12)}`,
    recordedAt: now,
    sha,
    mode,
    runId,
    status: 'FAIL',
    gatesExpected: 3,
    gatesExecuted: 0,
    rootCauses: ['RC-DIAGNOSTIC-001'],
    failures: [{ rootCauseId: 'RC-DIAGNOSTIC-001', occurrences: 1, fingerprints: ['FPR-DIAGNOSTIC-001'], repro: 'Inspect the earliest failed CI step before gate diagnostics were produced', affectedChecks: [] }],
    firstFailure: { gate: 'CI', rootCauseId: 'RC-DIAGNOSTIC-001', fingerprint: 'FPR-DIAGNOSTIC-001', repro: 'Inspect the earliest failed CI step before gate diagnostics were produced' },
    sourceReports: [],
  };
  writeCycleFiles(fallback);
  console.error('No gate report was produced; recorded fail-closed diagnostic cycle RC-DIAGNOSTIC-001.');
  process.exit(0);
}

const reports = gateReports.length > 0 ? gateReports : [JSON.parse(readFileSync(reportPath, 'utf8'))];
const allFailures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({ gate: report.gate, ...check })));
const clusters = new Map();
for (const failure of allFailures) {
  const rootCauseId = failure.rootCauseId ?? 'RC-UNKNOWN-001';
  const current = clusters.get(rootCauseId) ?? { rootCauseId, occurrences: 0, fingerprints: new Set(), repro: failure.repro ?? null, affectedChecks: [] };
  current.occurrences += 1;
  if (failure.fingerprint) current.fingerprints.add(failure.fingerprint);
  current.affectedChecks.push({ gate: failure.gate, label: failure.label, exitCode: failure.exitCode });
  clusters.set(rootCauseId, current);
}
const failures = [...clusters.values()].map((cluster) => ({ ...cluster, fingerprints: [...cluster.fingerprints] }));
const status = reports.length === gateNames.length && reports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL';
const rootCauses = failures.map((failure) => failure.rootCauseId);
const firstFailure = allFailures[0] ?? null;
const cycleFingerprint = createHash('sha256').update(JSON.stringify({ mode, rootCauses, failures: failures.map(({ fingerprints, ...item }) => item) })).digest('hex');
const cycleId = `RCYCLE-${cycleFingerprint.slice(0, 12).toUpperCase()}`;
const cycle = {
  schemaVersion: 2,
  schema: 'flixo-repair-cycle/v2',
  cycleId,
  recordedAt: now,
  sha,
  mode,
  runId,
  status,
  gatesExpected: gateNames.length,
  gatesExecuted: reports.length,
  rootCauses,
  failures,
  firstFailure: firstFailure ? { gate: firstFailure.gate, rootCauseId: firstFailure.rootCauseId ?? 'RC-UNKNOWN-001', fingerprint: firstFailure.fingerprint ?? null, repro: firstFailure.repro ?? null } : null,
  sourceReports: reports.map((report) => `${String(report.gate).toLowerCase()}.json`),
};
const ledger = writeCycleFiles(cycle);
const markdown = ['# Repair Cycle Diagnostic', '', `STATUS: ${status}`, `SHA: ${sha}`, `MODE: ${mode}`, `RUN: ${runId}`, `CYCLE: ${cycleId}`, '', `ROOT CAUSES: ${rootCauses.length}`, `FAILURE OCCURRENCES: ${ledger.totalFailureOccurrences}`, '', 'ROOT CAUSE CLUSTERS:', ...(failures.length ? failures.map((failure) => `- ${failure.rootCauseId}: ${failure.occurrences} occurrence(s), ${failure.fingerprints.join(', ') || 'no fingerprint'} — ${failure.repro ?? 'no focused repro'}`) : ['- NONE']), '', 'GATES:', ...reports.map((report) => `- ${report.gate}: ${report.status}`), ''];
writeFileSync(resolve(DIAG_DIR, 'repair-cycle-report.md'), `${markdown.join('\n')}\n`);
console.log(`REPAIR_CYCLE_ID=${cycleId}`);
console.log(`REPAIR_CYCLE_STATUS=${status}`);
console.log(`ROOT_CAUSES=${rootCauses.join(',') || 'NONE'}`);
console.log(`FAILURE_OCCURRENCES=${ledger.totalFailureOccurrences}`);
