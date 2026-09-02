import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ERROR_ARTIFACT_ROOT || 'error-artifacts';
const output = process.env.ERROR_REPORT_PATH || 'error-report.json';
const commit = process.env.GITHUB_SHA || 'unknown';
const setupResult = process.env.SETUP_RESULT || 'unknown';
const expectedJobs = 5;
const expectedE2eUnits = 12;

const files = fs.existsSync(root)
  ? fs.readdirSync(root, { recursive: true }).map((value) => path.join(root, value)).filter((value) => fs.existsSync(value) && fs.statSync(value).isFile())
  : [];

const results = files
  .filter((file) => file.endsWith('result.json'))
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
  .filter((result) => result && typeof result === 'object');

const classify = (message, job) => {
  const text = `${job}\n${message}`;
  if (/TS\d+|typeerror|cannot find module|type '.*' is not assignable/i.test(text)) return 'TypeError';
  if (/eslint|lint|no-unused|prettier/i.test(text)) return 'LintError';
  if (/contract|registry|route|assertion.*contract|validation failed/i.test(text)) return 'ContractError';
  return 'TestError';
};

const errors = [];
const baseJobs = new Set();
let e2eUnits = 0;

if (setupResult !== 'success') {
  errors.push({
    type: 'TestError',
    job: 'setup',
    file: null,
    message: `Phase 0 setup result: ${setupResult}.`,
  });
}

for (const result of results) {
  if (result.job) {
    baseJobs.add(result.job);
    if (result.job === 'e2e-matrix') e2eUnits += 1;
  }
  if (result.status === 'success') continue;
  const outputText = typeof result.output === 'string' ? result.output : '';
  const lines = outputText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /error|failed|failure|timeout|TS\d+/i.test(line));
  const selected = candidates.length ? candidates : [result.message || `${result.job || 'job'} failed`];
  for (const message of selected) {
    errors.push({
      type: classify(message, result.job),
      job: result.job,
      browser: result.browser || null,
      shard: result.shard || null,
      file: result.file || null,
      message,
    });
  }
}

const expectedResultCount = expectedJobs + expectedE2eUnits;
if (results.length !== expectedResultCount) {
  errors.push({
    type: 'TestError',
    job: 'aggregator',
    file: null,
    message: `Missing job result artifacts: expected ${expectedResultCount}, received ${results.length}.`,
  });
}

const byCategory = (type) => errors.filter((error) => error.type === type).length;
const report = {
  timestamp: new Date().toISOString(),
  commit,
  errors,
  summary: {
    total: errors.length,
    setup: setupResult === 'success' ? 0 : 1,
    typecheck: results.filter((r) => r.job === 'typecheck' && r.status !== 'success').length,
    lint: results.filter((r) => r.job === 'lint' && r.status !== 'success').length,
    contracts: results.filter((r) => r.job === 'contracts' && r.status !== 'success').length,
    unit: results.filter((r) => r.job === 'unit-tests' && r.status !== 'success').length,
    integration: results.filter((r) => r.job === 'integration-tests' && r.status !== 'success').length,
    e2e: results.filter((r) => r.job === 'e2e-matrix' && r.status !== 'success').length,
    expectedResults: expectedResultCount,
    receivedResults: results.length,
    expectedBaseJobs: expectedJobs,
    receivedBaseJobs: baseJobs.size,
    expectedE2eUnits,
    receivedE2eUnits: e2eUnits,
    classified: {
      TypeError: byCategory('TypeError'),
      LintError: byCategory('LintError'),
      ContractError: byCategory('ContractError'),
      TestError: byCategory('TestError'),
    },
  },
};

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${output}: ${errors.length} error(s).`);
if (errors.length > 0 || setupResult !== 'success' || results.some((result) => result.status !== 'success')) process.exitCode = 1;
