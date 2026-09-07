import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { collectNativeTests, testId } from './matrix-test-identity.mjs';

const reportPath = process.env.PLAYWRIGHT_JSON_REPORT || 'playwright-results.json';
const planPath = process.env.MATRIX_PLAN_PATH || '_flixo_matrix_plan.json';
const outputPath = process.env.MATRIX_EVIDENCE_OUTPUT || 'full-matrix-evidence/evidence.json';
const sourceSha = process.env.FLIXO_SOURCE_SHA;
const browser = process.env.MATRIX_BROWSER;
const shard = Number(process.env.MATRIX_SHARD);
const signingKey = process.env.FLIXO_MATRIX_PLAN_SIGNING_KEY;

if (!sourceSha || !browser || !Number.isInteger(shard) || shard < 1) throw new Error('Matrix evidence identity is incomplete.');
if (!signingKey) throw new Error('FLIXO_MATRIX_PLAN_SIGNING_KEY is required.');

const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const { plan_hash: planHash, signature, signature_algorithm: signatureAlgorithm, ...unsignedPlan } = plan;
if (plan.schema_version !== 4) throw new Error(`Unsupported matrix plan schema_version=${plan.schema_version}`);
if (!planHash || !signature || signatureAlgorithm !== 'HMAC-SHA256') throw new Error('Matrix plan signature metadata is invalid.');
const canonical = JSON.stringify(unsignedPlan);
const computedHash = createHash('sha256').update(canonical).digest('hex');
const computedSignature = createHmac('sha256', signingKey).update(canonical).digest('hex');
if (computedHash !== planHash) throw new Error(`Matrix plan hash mismatch: ${computedHash} != ${planHash}`);
if (computedSignature !== signature) throw new Error('Matrix plan signature mismatch.');
if (plan.source_sha !== sourceSha) throw new Error(`Matrix plan SHA mismatch: ${plan.source_sha} != ${sourceSha}`);

const unit = (plan.matrix || []).find((item) => item.browser === browser && Number(item.shard) === shard);
if (!unit) throw new Error(`Matrix plan unit missing: ${browser}:shard-${shard}`);
const plannedSuites = [...unit.tests].sort();
const plannedTestIds = [...unit.test_ids].sort();
const plannedTestCount = Number(unit.test_count);
if (!plannedSuites.length || !plannedTestIds.length || !Number.isInteger(plannedTestCount) || plannedTestCount < 1) throw new Error(`Matrix plan unit is incomplete: ${browser}:shard-${shard}`);
if (plannedTestIds.length !== plannedTestCount || new Set(plannedTestIds).size !== plannedTestIds.length) throw new Error(`Matrix plan unit test IDs/count are inconsistent: ${browser}:shard-${shard}`);

const reportText = readFileSync(reportPath, 'utf8');
const report = JSON.parse(reportText);
const tests = collectNativeTests(report);
const observedTestIds = tests.map(testId).sort();
const observedSuites = [...new Set(tests.map((test) => test.file.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')))].sort();
const expectedFiles = plannedSuites.map((suite) => `tests/${suite}.spec.ts`).sort();
const observedFiles = [...new Set(tests.map((test) => test.file))].sort();
const skipped = tests.filter((test) => test.status === 'skipped').length;
const unexpected = tests.filter((test) => test.status === 'unexpected').length;
const flaky = tests.filter((test) => test.status === 'flaky').length;
const failed = unexpected;

if (JSON.stringify(plannedSuites) !== JSON.stringify(observedSuites)) throw new Error('Planned suite != executed suite.');
if (JSON.stringify(expectedFiles) !== JSON.stringify(observedFiles)) throw new Error('Playwright executed an unplanned or missing suite.');
if (JSON.stringify(plannedTestIds) !== JSON.stringify(observedTestIds)) throw new Error(`Native test IDs mismatch for ${browser}:shard-${shard}`);
if (tests.length !== plannedTestCount) throw new Error(`planned_test_count=${plannedTestCount} != observed_test_count=${tests.length}`);
if (skipped !== 0 || unexpected !== 0 || failed !== 0 || flaky !== 0) throw new Error(`Native Playwright result is not clean: failed=${failed}, skipped=${skipped}, unexpected=${unexpected}, flaky=${flaky}`);

let playwrightVersion = null;
try { playwrightVersion = JSON.parse(readFileSync('node_modules/playwright/package.json', 'utf8')).version; } catch { playwrightVersion = null; }
const environment = {
  runner_os: process.env.RUNNER_OS || null,
  runner_arch: process.env.RUNNER_ARCH || process.arch,
  node_version: process.version,
  playwright_version: playwrightVersion,
  browser_project: browser,
  source_sha: sourceSha,
  lockfile_sha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
  plan_hash: planHash,
};
if (!environment.runner_os || !environment.playwright_version) throw new Error('Matrix environment fingerprint is incomplete.');

const result = {
  schema_version: 1,
  sha: sourceSha,
  plan_hash: planHash,
  environment,
  browser,
  shard,
  planned_suites: plannedSuites,
  executed_suites: observedSuites,
  planned_test_count: plannedTestCount,
  observed_test_count: tests.length,
  planned_test_ids: plannedTestIds,
  observed_test_ids: observedTestIds,
  failed,
  skipped,
  unexpected,
  flaky,
  native_report_path: basename(reportPath),
  native_report_sha256: createHash('sha256').update(reportText).digest('hex'),
  test_records: tests.map(({ file, title, titlePath, ordinal, status, results }) => ({ file, title, titlePath, ordinal, status, result_count: results.length })),
};

const resultText = JSON.stringify(result, null, 2) + '\n';
const resultSha = createHash('sha256').update(resultText).digest('hex');
writeFileSync(outputPath, resultText);
writeFileSync('full-matrix-evidence/evidence-artifact.sha256', `${resultSha}  ${outputPath}\n`);
console.log(JSON.stringify({ ...result, result_sha256: resultSha }, null, 2));
