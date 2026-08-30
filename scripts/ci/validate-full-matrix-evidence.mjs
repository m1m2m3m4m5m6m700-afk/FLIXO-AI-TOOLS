import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'full-matrix-evidence';
const expectedBrowsers = ['chromium', 'firefox', 'webkit'];
const expectedSuites = [
  'image-compressor', 'background-remover', 'image-upscaler', 'image-converter',
  'ai-image-generator', 'object-remover', 'watermark-remover', 'image-cropper',
  'image-to-svg', 'image-ocr', 'photo-colorizer', 'background-blur',
  'passport-photo-maker', 'watermark-adder', 'meme-generator', 'collage-maker',
  'image-effects', 'exif-cleaner', 'svg-optimizer', 'mockup-generator',
  'seed', 'pix', 'localization'
];
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Missing full matrix evidence directory: ${root}`);
}

const files = readdirSync(root).filter((name) => name.endsWith('.json')).map((name) => join(root, name));
if (!files.length) throw new Error('Full matrix evidence is empty.');
const records = files.map((file) => ({ file, record: JSON.parse(readFileSync(file, 'utf8')) }));
const seen = new Set();
const errors = [];
for (const { file, record } of records) {
  for (const key of ['sha', 'browser', 'shard', 'expected_suites', 'executed_suites', 'failed', 'skipped']) {
    if (!(key in record)) errors.push(`${file} missing ${key}`);
  }
  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (!expectedBrowsers.includes(record.browser)) errors.push(`${file} unknown browser=${record.browser}`);
  if (!Number.isInteger(record.shard) || record.shard < 1) errors.push(`${file} invalid shard=${record.shard}`);
  if (record.failed !== 0) errors.push(`${file} failed=${record.failed}`);
  if (record.skipped !== 0) errors.push(`${file} skipped=${record.skipped}`);
  const suites = Array.isArray(record.executed_suites) ? record.executed_suites : [];
  for (const suite of suites) {
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

const summary = {
  sha,
  expected: expectedBrowsers.length * expectedSuites.length,
  executed: seen.size,
  missing: expectedBrowsers.length * expectedSuites.length - seen.size,
  failed: records.reduce((sum, item) => sum + Number(item.record.failed || 0), 0),
  skipped: records.reduce((sum, item) => sum + Number(item.record.skipped || 0), 0),
  shards: files.length,
  result: errors.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
