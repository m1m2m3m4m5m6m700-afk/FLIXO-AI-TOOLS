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
const reportPath = resolve(DIAG_DIR, 'report.json');

if (!existsSync(reportPath)) {
  const fallback = {
    schemaVersion: 1,
    cycleId: `RCYCLE-MISSING-REPORT-${sha.slice(0, 12)}`,
    recordedAt: now,
    sha,
    mode,
    runId,
    status: 'FAIL',
    gatesExpected: 3,
    gatesExecuted: 0,
    rootCauses: ['RC-DIAGNOSTIC-001'],
    failures: [{
      rootCauseId: 'RC-DIAGNOSTIC-001',
      occurrences: 1,
      fingerprints: [],
      repro: null,
      affectedChecks: [],
    }],
    firstFailure: {
      gate: 'CI',
      rootCauseId: 'RC-DIAGNOSTIC-001',
      repro: 'Inspect the earliest failed CI step before the diagnostic runner produced report.json',
    },
    sourceReport: null,
  };
  appendFileSync(resolve(DIAG_DIR, 'repair-cycles.jsonl'), `${JSON.stringify(fallback)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'latest-repair-cycle.json'), `${JSON.stringify(fallback, null, 2)}\n`);
  writeFileSync(resolve(DIAG_DIR, 'failure-ledger.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: now,
    sha,
    mode,
    runId,
    status: 'FAIL',
    totalRootCauses: 1,
    totalFailureOccurrences: 1,
    rootCauses: fallback.failures,
  }, null, 2)}\n`);
  console.error('Diagnostic report missing; recorded fail-closed diagnostic cycle RC-DIAGNOSTIC-001.');
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const fingerprintInput = [sha, mode, JSON.stringify(report.rootCauses ?? []), JSON.stringify(report.clusters ?? [])].join('\n');
const cycleFingerprint = createHash('sha256').update(fingerprintInput).digest('hex');
const cycleId = `RCYCLE-${cycleFingerprint.slice(0, 12)}`;

const failures = (report.clusters ?? []).map((cluster) => ({
  rootCauseId: cluster.rootCauseId,
  occurrences: cluster.occurrences,
  fingerprints: cluster.fingerprints,
  repro: cluster.repro ?? null,
  affectedChecks: cluster.affectedChecks ?? [],
}));

const cycle = {
  schemaVersion: 1,
  cycleId,
  recordedAt: now,
  sha,
  mode,
  runId,
  status: report.status,
  gatesExpected: report.gatesExpected,
  gatesExecuted: report.gatesExecuted,
  rootCauses: report.rootCauses ?? [],
  failures,
  firstFailure: report.firstFailure ?? null,
  sourceReport: 'report.json',
};

appendFileSync(resolve(DIAG_DIR, 'repair-cycles.jsonl'), `${JSON.stringify(cycle)}\n`);
writeFileSync(resolve(DIAG_DIR, 'latest-repair-cycle.json'), `${JSON.stringify(cycle, null, 2)}\n`);

const failureLedger = {
  schemaVersion: 1,
  generatedAt: now,
  sha,
  mode,
  runId,
  status: report.status,
  totalRootCauses: failures.length,
  totalFailureOccurrences: failures.reduce((sum, item) => sum + item.occurrences, 0),
  rootCauses: failures,
};
writeFileSync(resolve(DIAG_DIR, 'failure-ledger.json'), `${JSON.stringify(failureLedger, null, 2)}\n`);

console.log(`REPAIR_CYCLE_ID=${cycleId}`);
console.log(`REPAIR_CYCLE_STATUS=${cycle.status}`);
console.log(`ROOT_CAUSES=${cycle.rootCauses.join(',') || 'NONE'}`);
console.log(`FAILURE_OCCURRENCES=${failureLedger.totalFailureOccurrences}`);
