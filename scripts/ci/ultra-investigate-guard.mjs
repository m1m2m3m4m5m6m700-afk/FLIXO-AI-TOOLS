import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'diagnostics/investigation/ultra-investigation.json';
const report = JSON.parse(readFileSync(file, 'utf8'));
const expectedSha = process.env.EXPECTED_SHA;

const errors = [];
if (expectedSha && report.sha !== expectedSha) errors.push(`SHA mismatch: ${report.sha} != ${expectedSha}`);
if (!Array.isArray(report.suites) || report.suites.length === 0) errors.push('Missing suite results');
for (const suite of report.suites ?? []) {
  if (suite.status !== 'PASS') errors.push(`Suite ${suite.suite} is ${suite.status}`);
  if ((suite.failures ?? []).length) errors.push(`Suite ${suite.suite} reports failures: ${suite.failures.join(', ')}`);
}
if ((report.failureCount ?? 0) !== 0) errors.push(`failureCount=${report.failureCount}`);
if ((report.rootCauseCount ?? 0) !== 0) errors.push(`rootCauseCount=${report.rootCauseCount}`);
if (report.status !== 'PASS') errors.push(`report.status=${report.status}`);

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PASS', sha: report.sha, suites: report.suites.length }, null, 2));
