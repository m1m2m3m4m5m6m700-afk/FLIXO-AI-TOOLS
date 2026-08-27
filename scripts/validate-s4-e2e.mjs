import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reportPath = process.env.S4_E2E_REPORT ?? join(root, 'playwright-report/results.json');

if (!existsSync(reportPath)) {
  console.error(`S4 FAIL: Playwright JSON report is missing: ${reportPath}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`S4 FAIL: unable to parse Playwright JSON report: ${error?.message ?? error}`);
  process.exit(1);
}

const counts = {
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
  unexpected: 0,
  total: 0,
};

const visit = (suite) => {
  for (const spec of suite?.specs ?? []) {
    for (const test of spec?.tests ?? []) {
      counts.total += 1;
      if (test.status === 'skipped' || test.expectedStatus === 'skipped') {
        counts.skipped += 1;
        continue;
      }

      const results = test.results ?? [];
      const statuses = results.map((result) => result?.status).filter(Boolean);
      const hasFailure = statuses.some((status) => status === 'failed' || status === 'timedOut' || status === 'interrupted');
      const allPassed = statuses.length > 0 && statuses.every((status) => status === 'passed');
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

for (const suite of report?.suites ?? []) visit(suite);

const expectedBrowsers = new Set(['chromium', 'firefox', 'webkit']);
const projects = new Set();
const collectProjects = (suite) => {
  for (const spec of suite?.specs ?? []) {
    for (const test of spec?.tests ?? []) {
      for (const result of test?.results ?? []) {
        if (result?.workerIndex !== undefined) {
          const project = test?.projectName;
          if (project) projects.add(project);
        }
      }
    }
  }
  for (const child of suite?.suites ?? []) collectProjects(child);
};
for (const suite of report?.suites ?? []) collectProjects(suite);

console.log(`S4 E2E totals: total=${counts.total} passed=${counts.passed} failed=${counts.failed} flaky=${counts.flaky} skipped=${counts.skipped} unexpected=${counts.unexpected}`);
if (counts.total === 0) {
  console.error('S4 FAIL: no E2E tests were recorded');
  process.exit(1);
}
if (counts.failed !== 0 || counts.flaky !== 0 || counts.skipped !== 0 || counts.unexpected !== 0) {
  console.error('S4 FAIL: runtime/E2E outcome contract was not satisfied');
  process.exit(1);
}

const requiredProjectNames = process.env.S4_REQUIRED_PROJECTS
  ? process.env.S4_REQUIRED_PROJECTS.split(',').map((value) => value.trim()).filter(Boolean)
  : [...expectedBrowsers];
const missingProjects = requiredProjectNames.filter((project) => !projects.has(project));
if (missingProjects.length) {
  console.error(`S4 FAIL: missing required browser projects in report: ${missingProjects.join(', ')}`);
  process.exit(1);
}

console.log(`S4 PASS: browsers=${[...projects].sort().join(',')} workers=1 retries=0`);
console.log('S4 RUNTIME + E2E GATE COMPLETE');
