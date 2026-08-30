import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'full-matrix-evidence';
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
const expectedBrowsers = ['chromium', 'firefox', 'webkit'];
const expectedSuites = Object.keys(JSON.parse(readFileSync('ci/test-duration-history.json', 'utf8')).tests);

if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Missing full matrix evidence directory: ${root}`);
}

const files = readdirSync(root)
  .filter((name) => name.endsWith('.json'))
  .map((name) => join(root, name));
if (!files.length) throw new Error('Full matrix evidence is empty.');

const records = files.map((file) => ({
  file,
  record: JSON.parse(readFileSync(file, 'utf8')),
}));
const seen = new Set();
const errors = [];

for (const { file, record } of records) {
  for (const key of ['sha', 'browser', 'shard', 'expected_suites', 'executed_suites', 'failed', 'status']) {
    if (!(key in record)) errors.push(`${file} missing ${key}`);
  }

  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (!expectedBrowsers.includes(record.browser)) errors.push(`${file} unknown browser=${record.browser}`);
  if (!Number.isInteger(record.shard) || record.shard < 1) errors.push(`${file} invalid shard=${record.shard}`);
  if (record.status !== 'success') errors.push(`${file} status=${record.status ?? 'missing'}`);
  if (Number(record.failed || 0) !== 0) errors.push(`${file} failed=${record.failed}`);

  const suites = Array.isArray(record.executed_suites) ? record.executed_suites : [];
  if (record.expected_suites !== expectedSuites.length) {
    errors.push(`${file} expected_suites=${record.expected_suites} != ${expectedSuites.length}`);
  }
  if (suites.length !== new Set(suites).size) errors.push(`${file} duplicate suites in shard evidence`);

  for (const suite of suites) {
    if (!expectedSuites.includes(suite)) errors.push(`${file} unknown executed suite=${suite}`);
    const key = `${record.browser}:${suite}`;
    if (seen.has(key)) errors.push(`duplicate execution: ${key}`);
    seen.add(key);
  }
}

for (const browser of expectedBrowsers) {
  for (const suite of expectedSuites) {
    const key = `${browser}:${suite}`;
    if (!seen.has(key)) errors.push(`missing execution: ${key}`);
  }
}

const expected = expectedBrowsers.length * expectedSuites.length;
const summary = {
  sha,
  expected,
  executed: seen.size,
  missing: expected - seen.size,
  failed: records.reduce((sum, item) => sum + Number(item.record.failed || 0), 0),
  shards: files.length,
  browsers: expectedBrowsers.length,
  suites: expectedSuites.length,
  result: errors.length ? 'FAIL' : 'PASS',
};

console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
