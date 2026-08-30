import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'full-matrix-evidence';
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
const expectedBrowsers = ['chromium', 'firefox', 'webkit'];
const expectedShards = 6;
const expectedSuites = Object.keys(
  JSON.parse(readFileSync('ci/test-duration-history.json', 'utf8')).tests,
);

if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Missing full matrix evidence directory: ${root}`);
}

const files = readdirSync(root)
  .filter((name) => name.endsWith('.json'))
  .map((name) => join(root, name));
const expectedRecords = expectedBrowsers.length * expectedShards;
const errors = [];

if (files.length !== expectedRecords) {
  errors.push(`evidence file count=${files.length} != ${expectedRecords}`);
}

const records = files.map((file) => ({
  file,
  record: JSON.parse(readFileSync(file, 'utf8')),
}));

const seenExecutions = new Set();
const seenBrowserShards = new Set();

for (const { file, record } of records) {
  for (const key of ['schema_version', 'sha', 'browser', 'shard', 'executed_suites', 'failed', 'skipped', 'status']) {
    if (!(key in record)) errors.push(`${file} missing ${key}`);
  }

  if (record.schema_version !== 3) errors.push(`${file} schema_version=${record.schema_version} != 3`);
  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (!expectedBrowsers.includes(record.browser)) errors.push(`${file} unknown browser=${record.browser}`);
  if (!Number.isInteger(record.shard) || record.shard < 1 || record.shard > expectedShards) {
    errors.push(`${file} invalid shard=${record.shard}`);
  }
  if (record.status !== 'success') errors.push(`${file} status=${record.status ?? 'missing'}`);
  if (Number(record.failed || 0) !== 0) errors.push(`${file} failed=${record.failed}`);
  if (Number(record.skipped || 0) !== 0) errors.push(`${file} skipped=${record.skipped}`);

  const browserShard = `${record.browser}:${record.shard}`;
  if (seenBrowserShards.has(browserShard)) errors.push(`duplicate browser/shard: ${browserShard}`);
  seenBrowserShards.add(browserShard);

  const suites = Array.isArray(record.executed_suites) ? record.executed_suites : [];
  if (!suites.length) errors.push(`${file} executed_suites is empty`);

  const localSuites = new Set();
  for (const suite of suites) {
    if (!expectedSuites.includes(suite)) errors.push(`${file} unknown executed suite=${suite}`);
    if (localSuites.has(suite)) errors.push(`${file} duplicate suite=${suite}`);
    localSuites.add(suite);

    const key = `${record.browser}:${suite}`;
    if (seenExecutions.has(key)) errors.push(`duplicate execution: ${key}`);
    seenExecutions.add(key);
  }
}

for (const browser of expectedBrowsers) {
  for (let shard = 1; shard <= expectedShards; shard += 1) {
    const key = `${browser}:${shard}`;
    if (!seenBrowserShards.has(key)) errors.push(`missing browser/shard: ${key}`);
  }
  for (const suite of expectedSuites) {
    const key = `${browser}:${suite}`;
    if (!seenExecutions.has(key)) errors.push(`missing execution: ${key}`);
  }
}

const expected = expectedBrowsers.length * expectedSuites.length;
const summary = {
  sha,
  expected,
  executed: seenExecutions.size,
  missing: expected - seenExecutions.size,
  failed: records.reduce((sum, item) => sum + Number(item.record.failed || 0), 0),
  skipped: records.reduce((sum, item) => sum + Number(item.record.skipped || 0), 0),
  shards: files.length,
  browsers: expectedBrowsers.length,
  suites: expectedSuites.length,
  result: errors.length ? 'FAIL' : 'PASS',
};

console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
