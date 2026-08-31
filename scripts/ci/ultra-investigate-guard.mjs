import { readFileSync } from 'node:fs';
import { ULTRA_SCHEMA_VERSION, ULTRA_SUITE_NAMES, ultraContractHash } from './ultra-contract.mjs';

const file = process.argv[2] ?? 'diagnostics/investigation/aggregate.json';
const report = JSON.parse(readFileSync(file, 'utf8'));
const expectedSha = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA;
const errors = [];

function requireEqual(actual, expected, label) {
  if (actual !== expected) errors.push(`${label}: ${actual} != ${expected}`);
}

if (report.schema_version !== ULTRA_SCHEMA_VERSION) errors.push(`schema_version=${report.schema_version}`);
if (expectedSha) requireEqual(report.sha, expectedSha, 'report.sha');
requireEqual(report.contractHash, ultraContractHash(), 'contractHash');
requireEqual(report.suiteCount, ULTRA_SUITE_NAMES.length, 'suiteCount');
requireEqual(report.expectedSuiteCount, ULTRA_SUITE_NAMES.length, 'expectedSuiteCount');
requireEqual(report.failureCount, 0, 'failureCount');
requireEqual(report.rootCauseCount, 0, 'rootCauseCount');
requireEqual(report.unknownCount, 0, 'unknownCount');
if (report.status !== 'PASS') errors.push(`report.status=${report.status}`);
if (!Array.isArray(report.suites)) errors.push('Missing suites array');

const actualSuites = new Set();
for (const suite of report.suites ?? []) {
  if (actualSuites.has(suite.suite)) errors.push(`Duplicate suite=${suite.suite}`);
  actualSuites.add(suite.suite);
  if (!ULTRA_SUITE_NAMES.includes(suite.suite)) errors.push(`Unexpected suite=${suite.suite}`);
  if (expectedSha) requireEqual(suite.sha, expectedSha, `${suite.suite}.sha`);
  if (suite.status !== 'PASS') errors.push(`Suite ${suite.suite} is ${suite.status}`);
  requireEqual(suite.expected, suite.executed, `${suite.suite}.executed`);
  requireEqual(suite.failed, 0, `${suite.suite}.failed`);
  requireEqual(suite.skipped, 0, `${suite.suite}.skipped`);
  requireEqual(suite.missing, 0, `${suite.suite}.missing`);
  if ((suite.failures ?? []).length) errors.push(`${suite.suite}.failures=${suite.failures.join(',')}`);
}
for (const suite of ULTRA_SUITE_NAMES) if (!actualSuites.has(suite)) errors.push(`Missing suite=${suite}`);

const generatedAt = Date.parse(report.generatedAt ?? '');
if (!Number.isFinite(generatedAt)) errors.push('generatedAt is invalid');
else if (Date.now() - generatedAt > 24 * 60 * 60 * 1000) errors.push('Evidence is older than 24 hours');
if (process.env.GITHUB_RUN_ID) requireEqual(String(report.runId), process.env.GITHUB_RUN_ID, 'runId');
if (process.env.GITHUB_RUN_ATTEMPT) requireEqual(String(report.runAttempt), process.env.GITHUB_RUN_ATTEMPT, 'runAttempt');

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PASS', sha: report.sha, suites: report.suiteCount, rootCauses: 0, unknown: 0 }, null, 2));
