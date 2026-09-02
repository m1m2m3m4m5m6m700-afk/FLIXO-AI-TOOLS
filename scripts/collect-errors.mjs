import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ERROR_ARTIFACT_ROOT || 'error-artifacts';
const output = process.env.ERROR_REPORT_PATH || 'error-report.json';
const commit = process.env.GITHUB_SHA || 'unknown';
const setupResult = process.env.SETUP_RESULT || 'unknown';
const baseJobs = ['typecheck', 'lint', 'contracts', 'unit-tests', 'integration-tests'];
const browsers = ['chromium', 'firefox', 'webkit'];
const shards = ['1/4', '2/4', '3/4', '4/4'];
const expectedIds = new Set(baseJobs);
for (const browser of browsers) for (const shard of shards) expectedIds.add(`e2e-matrix:${browser}:${shard}`);

const files = fs.existsSync(root)
  ? fs.readdirSync(root, { recursive: true })
      .map((value) => path.join(root, value))
      .filter((value) => fs.existsSync(value) && fs.statSync(value).isFile())
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
const seen = new Set();

const addStructuralError = (message) => errors.push({ type: 'TestError', job: 'aggregator', browser: null, shard: null, file: null, message });

if (setupResult !== 'success') addStructuralError(`Phase 0 setup result: ${setupResult}.`);

for (const result of results) {
  const id = result.job === 'e2e-matrix'
    ? `e2e-matrix:${result.browser || 'unknown'}:${result.shard || 'unknown'}`
    : result.job;
  if (seen.has(id)) addStructuralError(`Duplicate job result artifact identity: ${id}.`);
  seen.add(id);

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

for (const id of expectedIds) if (!seen.has(id)) addStructuralError(`Missing job result artifact identity: ${id}.`);

const byCategory = (type) => errors.filter((error) => error.type === type).length;
const failedJobs = new Set(results.filter((result) => result.status !== 'success').map((result) => result.job));
const report = {
  timestamp: new Date().toISOString(),
  commit,
  errors,
  summary: {
    total: errors.length,
    setup: setupResult === 'success' ? 0 : 1,
    typecheck: failedJobs.has('typecheck') ? 1 : 0,
    lint: failedJobs.has('lint') ? 1 : 0,
    contracts: failedJobs.has('contracts') ? 1 : 0,
    unit: failedJobs.has('unit-tests') ? 1 : 0,
    integration: failedJobs.has('integration-tests') ? 1 : 0,
    e2e: failedJobs.has('e2e-matrix') ? 1 : 0,
    expectedResults: expectedIds.size,
    receivedResults: results.length,
    expectedIdentities: expectedIds.size,
    receivedIdentities: seen.size,
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
