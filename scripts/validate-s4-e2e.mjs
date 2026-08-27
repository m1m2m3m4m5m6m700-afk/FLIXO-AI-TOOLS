import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reportPath = process.env.S4_E2E_REPORT ?? join(root, 'playwright-report/results.json');

const fail = (message) => {
  console.error(`S4 FAIL: ${message}`);
  process.exit(1);
};

if (!existsSync(reportPath)) fail(`Playwright JSON report is missing: ${reportPath}`);

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  fail(`unable to parse Playwright JSON report: ${error?.message ?? error}`);
}

if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) {
  fail('Playwright JSON report has an invalid top-level structure');
}

const counts = {
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
  unexpected: 0,
  total: 0,
};

const projects = new Set();

const visit = (suite) => {
  for (const spec of suite?.specs ?? []) {
    for (const test of spec?.tests ?? []) {
      counts.total += 1;
      if (test?.projectName) projects.add(test.projectName);

      if (test.status === 'skipped' || test.expectedStatus === 'skipped') {
        counts.skipped += 1;
        continue;
      }

      const results = Array.isArray(test.results) ? test.results : [];
      if (results.length === 0) {
        counts.unexpected += 1;
        continue;
      }

      const statuses = results.map((result) => result?.status).filter(Boolean);
      const hasFailure = statuses.some((status) => status === 'failed' || status === 'timedOut' || status === 'interrupted');
      const allPassed = statuses.length === results.length && statuses.every((status) => status === 'passed');
      const multipleAttempts = results.length > 1;

      if (hasFailure) {
        counts.failed += 1;
        counts.unexpected += 1;
      } else if (allPassed && multipleAttempts) {
        counts.flaky += 1;
      } else if (allPassed || test.status === 'expected') {
        counts.passed += 1;
      } else {
        counts.unexpected += 1;
      }
    }
  }

  for (const child of suite?.suites ?? []) visit(child);
};

for (const suite of report.suites) visit(suite);

const requiredProjectNames = process.env.S4_REQUIRED_PROJECTS
  ? process.env.S4_REQUIRED_PROJECTS.split(',').map((value) => value.trim()).filter(Boolean)
  : ['chromium', 'firefox', 'webkit'];

console.log(`S4 E2E totals: total=${counts.total} passed=${counts.passed} failed=${counts.failed} flaky=${counts.flaky} skipped=${counts.skipped} unexpected=${counts.unexpected}`);
if (counts.total === 0) fail('no E2E tests were recorded');
if (counts.failed !== 0 || counts.flaky !== 0 || counts.skipped !== 0 || counts.unexpected !== 0) {
  fail('runtime/E2E outcome contract was not satisfied');
}

const missingProjects = requiredProjectNames.filter((project) => !projects.has(project));
if (missingProjects.length) {
  fail(`missing required browser projects in report: ${missingProjects.join(', ')}`);
}

const unexpectedProjects = [...projects].filter((project) => !requiredProjectNames.includes(project)).sort();
if (unexpectedProjects.length) {
  fail(`unexpected browser projects in report: ${unexpectedProjects.join(', ')}`);
}

console.log(`S4 PASS: browsers=${[...projects].sort().join(',')} workers=1 retries=0`);
console.log('S4 RUNTIME + E2E GATE COMPLETE');
