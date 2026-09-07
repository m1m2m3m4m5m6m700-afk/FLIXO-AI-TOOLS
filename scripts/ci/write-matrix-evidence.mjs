import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const reportPath = process.env.PLAYWRIGHT_JSON_REPORT || 'playwright-results.json';
const outputPath = process.env.MATRIX_EVIDENCE_OUTPUT || 'full-matrix-evidence/evidence.json';
const sourceSha = process.env.FLIXO_SOURCE_SHA;
const planHash = process.env.MATRIX_PLAN_HASH;
const browser = process.env.MATRIX_BROWSER;
const shard = Number(process.env.MATRIX_SHARD);
const plannedSuites = (process.env.MATRIX_TESTS || '').split(',').filter(Boolean);
const plannedTestCount = Number(process.env.MATRIX_TEST_COUNT || 0);

if (!sourceSha || !planHash || !browser || !Number.isInteger(shard) || shard < 1) throw new Error('Matrix evidence identity is incomplete.');
if (!plannedSuites.length || !Number.isInteger(plannedTestCount) || plannedTestCount < 1) throw new Error('Matrix plan binding is incomplete.');

const reportText = readFileSync(reportPath, 'utf8');
const report = JSON.parse(reportText);

const tests = [];
const walk = (suite) => {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) tests.push({
      file: spec.file,
      title: spec.title,
      status: test.status,
      results: test.results || [],
    });
  }
  for (const child of suite.suites || []) walk(child);
};
for (const suite of report.suites || []) walk(suite);

const observedTestCount = tests.length;
const skipped = tests.filter((test) => test.status === 'skipped').length;
const unexpected = tests.filter((test) => test.status === 'unexpected').length;
const flaky = tests.filter((test) => test.status === 'flaky').length;
const failed = unexpected;
const expectedByFile = new Set(plannedSuites.map((suite) => `tests/${suite}.spec.ts`));
const observedFiles = [...new Set(tests.map((test) => test.file))].sort();
const expectedFiles = [...expectedByFile].sort();
const executedSuites = [...new Set(observedFiles.map((file) => file.replace(/^tests\\//, '').replace(/\\.spec\\.ts$/, '')))].sort();

const unknownFiles = observedFiles.filter((file) => !expectedByFile.has(file));
if (unknownFiles.length) throw new Error(`Playwright executed unplanned suites: ${unknownFiles.join(', ')}`);

const result = {
  schema_version: 1,
  sha: sourceSha,
  plan_hash: planHash,
  browser,
  shard,
  planned_suites: expectedFiles,
  executed_suites: executedSuites,
  planned_test_count: plannedTestCount,
  observed_test_count: observedTestCount,
  failed,
  skipped,
  unexpected,
  flaky,
  test_records: tests.map(({ file, title, status, results }) => ({ file, title, status, result_count: results.length })),
};

const resultText = JSON.stringify(result, null, 2) + '\n';
const resultSha = createHash('sha256').update(resultText).digest('hex');
writeFileSync(outputPath, resultText);
writeFileSync('full-matrix-evidence/evidence-artifact.sha256', `${resultSha}  ${outputPath}\n`);

console.log(JSON.stringify({ ...result, result_sha256: resultSha }, null, 2));
