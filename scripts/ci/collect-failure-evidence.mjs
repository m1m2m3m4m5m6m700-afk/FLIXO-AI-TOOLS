#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
const now = new Date().toISOString();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (name) => {
  const path = resolve(DIR, name);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};
const fileHash = (name) => {
  const path = resolve(DIR, name);
  return existsSync(path) ? sha256(readFileSync(path)) : null;
};
const git = (args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return (result.stdout ?? '').trim();
};

const context = readJson('execution-context.json');
const reports = ['static.json', 'build.json', 'browser.json'].map(readJson).filter(Boolean);
const failures = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({
  gate: report.gate,
  ...check,
})));
const skipped = reports.flatMap((report) => (report.checks ?? []).filter((check) => check.status === 'SKIPPED').map((check) => ({ gate: report.gate, label: check.label })));
const masked = reports.some((report) => report.status === 'PASS' && Number(report.failures ?? 0) > 0)
  || reports.some((report) => report.status === 'PASS' && Number(report.checksExecuted ?? 0) < Number(report.checksExpected ?? 0));
const bundle = {
  schema: 'flixo-failure-evidence/v1',
  generatedAt: now,
  sha: git(['rev-parse', 'HEAD']),
  executionIdentityHash: context?.identityHash ?? null,
  contextArtifact: 'execution-context.json',
  reports: reports.map((report) => ({
    gate: report.gate,
    status: report.status,
    sha: report.sha,
    mode: report.mode,
    checksExpected: report.checksExpected,
    checksExecuted: report.checksExecuted,
    failures: report.failures,
    rootCauses: report.rootCauses ?? [],
    artifactSha256: fileHash(`${String(report.gate).toLowerCase()}.json`),
  })),
  failures,
  skipped,
  repository: {
    head: git(['rev-parse', 'HEAD']),
    statusPorcelain: git(['status', '--porcelain']),
    diffStat: git(['diff', '--stat']),
  },
  integrity: {
    contextSha256: fileHash('execution-context.json'),
    staticReportSha256: fileHash('static.json'),
    buildReportSha256: fileHash('build.json'),
    browserReportSha256: fileHash('browser.json'),
  },
  invariants: {
    exactShaMatch: Boolean(context?.execution?.expectedSha && context.execution.expectedSha === context.execution.sha),
    cleanCheckout: context?.execution?.dirty === false,
    requiredTestsSkipped: skipped.length > 0,
    maskedFailures: masked,
    staleEvidence: reports.some((report) => report.sha && report.sha !== context?.execution?.sha),
  },
};

bundle.evidenceId = `EVD-${sha256(JSON.stringify(bundle)).slice(0, 16).toUpperCase()}`;
writeFileSync(resolve(DIR, 'failure-evidence.json'), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`FAILURE_EVIDENCE_ID=${bundle.evidenceId}`);
console.log(`FAILURE_EVIDENCE_SHA256=${fileHash('failure-evidence.json')}`);
console.log(`FAILURE_COUNT=${failures.length}`);
console.log(`SKIPPED_REQUIRED=${skipped.length}`);
console.log(`MASKED_FAILURES=${masked}`);
console.log(`STALE_EVIDENCE=${bundle.invariants.staleEvidence}`);
