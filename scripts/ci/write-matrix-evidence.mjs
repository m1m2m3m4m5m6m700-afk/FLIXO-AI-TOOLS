import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const reportPath = process.env.PLAYWRIGHT_JSON_REPORT || 'playwright-results.json';
const inventoryPath = process.env.MATRIX_TEST_INVENTORY_PATH || 'matrix-test-inventory.json';
const outputPath = process.env.MATRIX_EVIDENCE_OUTPUT || 'full-matrix-evidence/evidence.json';
const sourceSha = process.env.FLIXO_SOURCE_SHA;
const planHash = process.env.MATRIX_PLAN_HASH;
const browser = process.env.MATRIX_BROWSER;
const shard = Number(process.env.MATRIX_SHARD);
const plannedSuites = (process.env.MATRIX_TESTS || '').split(',').filter(Boolean);
const plannedTestCount = Number(process.env.MATRIX_TEST_COUNT || 0);

if (!sourceSha || !planHash || !browser || !Number.isInteger(shard) || shard < 1) throw new Error('Matrix evidence identity is incomplete.');
if (!plannedSuites.length || !Number.isInteger(plannedTestCount) || plannedTestCount < 1) throw new Error('Matrix plan binding is incomplete.');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
if (inventory.schema_version !== 1 || inventory.source_sha !== sourceSha || inventory.plan_hash !== planHash) throw new Error('Matrix test inventory provenance mismatch.');
const inventoryUnit = (inventory.units || []).find((unit) => unit.browser === browser && Number(unit.shard) === shard);
if (!inventoryUnit) throw new Error(`Missing test inventory unit ${browser}:shard-${shard}.`);

const reportText = readFileSync(reportPath, 'utf8');
const report = JSON.parse(reportText);
const tests = [];
const walk = (suite) => {
  for (const spec of suite.specs || []) {
    for (const [index, test] of (spec.tests || []).entries()) tests.push({ file: spec.file, title: spec.title, ordinal: index, status: test.status, results: test.results || [] });
  }
  for (const child of suite.suites || []) walk(child);
};
for (const suite of report.suites || []) walk(suite);

const normalizeSuite = (file) => file.replace(/^.*[\\/]tests[\\/]/, '').replace(/\.spec\.ts$/, '');
const testId = (test) => `${test.file}::${test.title}::${test.ordinal}`;
const observedIds = tests.map(testId).sort();
const plannedIds = (inventoryUnit.tests || []).map((test) => test.id).sort();
const observedTestCount = tests.length;
const skipped = tests.filter((test) => test.status === 'skipped').length;
const unexpected = tests.filter((test) => test.status === 'unexpected').length;
const flaky = tests.filter((test) => test.status === 'flaky').length;
const failed = unexpected;
const expectedSuites = [...plannedSuites].sort();
const observedSuites = [...new Set(tests.map((test) => normalizeSuite(test.file)))].sort();
const observedFiles = [...new Set(tests.map((test) => test.file))].sort();
const expectedFiles = expectedSuites.map((suite) => `tests/${suite}.spec.ts`).sort();

if (JSON.stringify(expectedSuites) !== JSON.stringify(observedSuites)) throw new Error('Planned suite != executed suite.');
if (JSON.stringify(expectedFiles) !== JSON.stringify(observedFiles)) throw new Error('Playwright executed an unplanned or missing suite.');
if (observedTestCount !== plannedTestCount) throw new Error(`planned_test_count=${plannedTestCount} != observed_test_count=${observedTestCount}`);
if (observedTestCount !== Number(inventoryUnit.test_count)) throw new Error(`inventory_test_count=${inventoryUnit.test_count} != observed_test_count=${observedTestCount}`);
if (JSON.stringify(plannedIds) !== JSON.stringify(observedIds)) throw new Error(`Native test inventory mismatch for ${browser}:shard-${shard}`);
if (skipped !== 0 || unexpected !== 0 || failed !== 0 || flaky !== 0) throw new Error(`Native Playwright result is not clean: failed=${failed}, skipped=${skipped}, unexpected=${unexpected}, flaky=${flaky}`);

const result = {
  schema_version: 1,
  sha: sourceSha,
  plan_hash: planHash,
  inventory_hash: inventory.inventory_hash,
  browser,
  shard,
  planned_suites: expectedSuites,
  executed_suites: observedSuites,
  planned_test_count: plannedTestCount,
  observed_test_count: observedTestCount,
  planned_test_ids: plannedIds,
  observed_test_ids: observedIds,
  failed,
  skipped,
  unexpected,
  flaky,
  native_report_path: basename(reportPath),
  native_report_sha256: createHash('sha256').update(reportText).digest('hex'),
  test_records: tests.map(({ file, title, ordinal, status, results }) => ({ file, title, ordinal, status, result_count: results.length })),
};

const resultText = JSON.stringify(result, null, 2) + '\n';
const resultSha = createHash('sha256').update(resultText).digest('hex');
writeFileSync(outputPath, resultText);
writeFileSync('full-matrix-evidence/evidence-artifact.sha256', `${resultSha}  ${outputPath}\n`);
console.log(JSON.stringify({ ...result, result_sha256: resultSha }, null, 2));
