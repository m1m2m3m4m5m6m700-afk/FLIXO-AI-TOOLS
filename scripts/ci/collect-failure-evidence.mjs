#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
const now = new Date().toISOString();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (name) => { const path = resolve(DIR, name); if (!existsSync(path)) return null; try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
const fileHash = (name) => { const path = resolve(DIR, name); return existsSync(path) ? sha256(readFileSync(path)) : null; };
const git = (gitArgs) => { const result = spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }); return (result.stdout ?? '').trim(); };
const context = readJson('execution-context.json');
const overall = readJson('report.json');
const plan = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/test-plan.json'), 'utf8'));
const expected = Object.fromEntries(Object.entries(plan.gates).map(([name, data]) => [name.toUpperCase(), data.expected]));
const requiredGates = Object.keys(expected);
const reports = requiredGates.map((gate) => ({ name: gate, report: readJson(`${gate.toLowerCase()}.json`) }));
const missingReports = reports.filter(({ report }) => !report).map(({ name }) => name);
const failures = reports.flatMap(({ name, report }) => (report?.checks ?? []).filter((check) => check.status === 'FAIL').map((check) => ({ gate: name, ...check })));
const skipped = reports.flatMap(({ name, report }) => (report?.checks ?? []).filter((check) => check.status === 'SKIPPED').map((check) => ({ gate: name, label: check.label })));
const blocked = reports.filter(({ report }) => report?.status === 'BLOCKED').map(({ name }) => name);
const incompleteReports = reports.filter(({ name, report }) => !report || report.sha !== context?.execution?.sha || report.checksExpected !== expected[name] || report.checksExecuted !== expected[name] || report.status !== 'PASS');
const masked = reports.some(({ report }) => report?.status === 'PASS' && Number(report.failures ?? 0) > 0) || reports.some(({ report }) => report?.status === 'PASS' && Number(report.checksExecuted ?? 0) < Number(report.checksExpected ?? 0));
const exactSha = Boolean(context?.execution?.expectedSha && context.execution.expectedSha === context.execution.sha && context.execution.sha === git(['rev-parse', 'HEAD']));
const overallCoherent = Boolean(overall?.sha === context?.execution?.sha && overall?.gatesExpected === requiredGates.length && overall?.gatesExecuted === requiredGates.length);
const authoritative = missingReports.length === 0 && incompleteReports.length === 0 && blocked.length === 0 && failures.length === 0 && skipped.length === 0 && !masked && exactSha && overallCoherent;
const bundle = {
  schema: 'flixo-failure-evidence/v3', generatedAt: now, sha: git(['rev-parse', 'HEAD']), executionIdentityHash: context?.identityHash ?? null,
  contextArtifact: 'execution-context.json', overallArtifact: 'report.json',
  testPlan: { version: plan.version, gates: plan.gates },
  reports: reports.map(({ name, report }) => ({ gate: name, present: Boolean(report), status: report?.status ?? 'MISSING', sha: report?.sha ?? null, mode: report?.mode ?? null, checksExpected: report?.checksExpected ?? null, checksExecuted: report?.checksExecuted ?? null, expectedChecks: expected[name], failures: report?.failures ?? null, rootCauses: report?.rootCauses ?? [], artifactSha256: fileHash(`${name.toLowerCase()}.json`) })),
  failures, skipped, blocked,
  completeness: { requiredGates, missingReports, incompleteReports: incompleteReports.map(({ name }) => name), blockedGates: blocked, allRequiredReportsPresent: missingReports.length === 0, allExpectedChecksExecuted: incompleteReports.length === 0, overallCoherent, authoritative },
  repository: { head: git(['rev-parse', 'HEAD']), statusPorcelain: git(['status', '--porcelain']), diffStat: git(['diff', '--stat']) },
  integrity: { contextSha256: fileHash('execution-context.json'), overallReportSha256: fileHash('report.json'), staticReportSha256: fileHash('static.json'), buildReportSha256: fileHash('build.json'), browserReportSha256: fileHash('browser.json') },
  invariants: { exactShaMatch: exactSha, cleanCheckout: context?.execution?.dirty === false, requiredTestsSkipped: skipped.length > 0, maskedFailures: masked, staleEvidence: reports.some(({ report }) => report?.sha && report.sha !== context?.execution?.sha) },
};
bundle.evidenceId = `EVD-${sha256(JSON.stringify(bundle)).slice(0, 16).toUpperCase()}`;
writeFileSync(resolve(DIR, 'failure-evidence.json'), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`FAILURE_EVIDENCE_ID=${bundle.evidenceId}`);
console.log(`FAILURE_EVIDENCE_SHA256=${fileHash('failure-evidence.json')}`);
console.log(`FAILURE_COUNT=${failures.length}`);
console.log(`SKIPPED_REQUIRED=${skipped.length}`);
console.log(`MASKED_FAILURES=${masked}`);
console.log(`STALE_EVIDENCE=${bundle.invariants.staleEvidence}`);
console.log(`EVIDENCE_AUTHORITATIVE=${authoritative}`);
if (!authoritative) process.exitCode = 1;
