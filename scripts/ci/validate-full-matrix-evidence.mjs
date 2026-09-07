import { createHash, createHmac } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'full-matrix-evidence';
const planPath = process.env.MATRIX_PLAN_PATH || join(root, '_flixo_matrix_plan.json');
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
const signingKey = process.env.FLIXO_MATRIX_PLAN_SIGNING_KEY;

if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');
if (!signingKey) throw new Error('FLIXO_MATRIX_PLAN_SIGNING_KEY is required.');
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing full matrix evidence directory: ${root}`);
if (!statSync(planPath, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing immutable matrix plan: ${planPath}`);

const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const { plan_hash: planHash, signature, signature_algorithm: signatureAlgorithm, ...unsignedPlan } = plan;
if (!planHash || !signature || signatureAlgorithm !== 'HMAC-SHA256') throw new Error('Matrix plan signature metadata is invalid.');
const canonical = JSON.stringify(unsignedPlan);
const computedHash = createHash('sha256').update(canonical).digest('hex');
const computedSignature = createHmac('sha256', signingKey).update(canonical).digest('hex');
if (computedHash !== planHash) throw new Error(`Matrix plan hash mismatch: ${computedHash} != ${planHash}`);
if (computedSignature !== signature) throw new Error('Matrix plan signature mismatch.');
if (plan.source_sha !== sha) throw new Error(`Matrix plan SHA mismatch: ${plan.source_sha} != ${sha}`);

const expectedBrowsers = plan.browsers;
const expectedShards = Number(plan.shard_count);
const expectedSuites = new Set(plan.suites);
const matrix = plan.matrix;
if (!Array.isArray(expectedBrowsers) || expectedBrowsers.length === 0) throw new Error('Matrix plan has no browsers.');
if (!Number.isInteger(expectedShards) || expectedShards < 1) throw new Error('Matrix plan has invalid shard_count.');
if (!Array.isArray(matrix) || matrix.length !== expectedBrowsers.length * expectedShards) throw new Error('Matrix plan matrix cardinality is invalid.');

const expectedByBrowserShard = new Map();
for (const unit of matrix) {
  const key = `${unit.browser}:${unit.shard}`;
  if (expectedByBrowserShard.has(key)) throw new Error(`Duplicate plan unit: ${key}`);
  if (!expectedBrowsers.includes(unit.browser)) throw new Error(`Unknown planned browser: ${unit.browser}`);
  if (!Number.isInteger(unit.shard) || unit.shard < 1 || unit.shard > expectedShards) throw new Error(`Invalid planned shard: ${key}`);
  if (!Array.isArray(unit.tests) || unit.tests.length === 0) throw new Error(`Empty planned suite set: ${key}`);
  expectedByBrowserShard.set(key, unit);
}

const files = readdirSync(root).filter((name) => name.endsWith('.json') && name !== '_flixo_matrix_plan.json');
const errors = [];
const records = [];
const seenUnits = new Set();
const seenExecutions = new Set();

for (const fileName of files) {
  const file = join(root, fileName);
  const record = JSON.parse(readFileSync(file, 'utf8'));
  records.push({ file, record });
  for (const key of ['schema_version', 'sha', 'plan_hash', 'browser', 'shard', 'executed_suites', 'planned_test_count', 'observed_test_count', 'failed', 'skipped', 'unexpected', 'status', 'result_artifact']) {
    if (!(key in record)) errors.push(`${file} missing ${key}`);
  }
  if (record.schema_version !== 4) errors.push(`${file} schema_version=${record.schema_version} != 4`);
  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (record.plan_hash !== planHash) errors.push(`${file} plan hash mismatch: ${record.plan_hash} != ${planHash}`);
  if (record.status !== 'success') errors.push(`${file} status=${record.status ?? 'missing'}`);
  for (const field of ['failed', 'skipped', 'unexpected']) if (Number(record[field] || 0) !== 0) errors.push(`${file} ${field}=${record[field]}`);
  if (!Number.isInteger(record.planned_test_count) || !Number.isInteger(record.observed_test_count)) errors.push(`${file} test counts must be integers`);
  if (record.planned_test_count !== record.observed_test_count) errors.push(`${file} planned_test_count=${record.planned_test_count} != observed_test_count=${record.observed_test_count}`);
  if (!Array.isArray(record.executed_suites)) errors.push(`${file} executed_suites is not an array`);

  const unitKey = `${record.browser}:${record.shard}`;
  const unit = expectedByBrowserShard.get(unitKey);
  if (!unit) errors.push(`${file} is not present in immutable plan: ${unitKey}`);
  else {
    if (seenUnits.has(unitKey)) errors.push(`duplicate evidence unit: ${unitKey}`);
    seenUnits.add(unitKey);
    const plannedSuites = [...unit.tests].sort();
    const executedSuites = [...record.executed_suites].sort();
    if (JSON.stringify(plannedSuites) !== JSON.stringify(executedSuites)) errors.push(`${file} planned suite != executed suite`);
    if (record.planned_test_count !== Number(unit.test_count)) errors.push(`${file} planned_test_count=${record.planned_test_count} != plan=${unit.test_count}`);
  }

  if (!statSync(record.result_artifact, { throwIfNoEntry: false })?.isFile()) errors.push(`${file} missing result artifact ${record.result_artifact}`);
  else {
    const resultText = readFileSync(record.result_artifact, 'utf8');
    const result = JSON.parse(resultText);
    const resultHash = createHash('sha256').update(resultText).digest('hex');
    if (record.result_artifact_sha256 !== resultHash) errors.push(`${file} result artifact SHA mismatch`);
    if (result.sha !== sha) errors.push(`${file} result artifact SHA mismatch: ${result.sha} != ${sha}`);
    if (result.plan_hash !== planHash) errors.push(`${file} result artifact plan hash mismatch`);
    if (Number(result.observed_test_count) !== Number(record.observed_test_count)) errors.push(`${file} result observed test count mismatch`);
    if (Number(result.failed) !== 0 || Number(result.skipped) !== 0 || Number(result.unexpected) !== 0) errors.push(`${file} native result contains failure/skip/unexpected`);
  }
}

for (const key of expectedByBrowserShard.keys()) if (!seenUnits.has(key)) errors.push(`missing evidence unit: ${key}`);
for (const browser of expectedBrowsers) {
  const browserSuites = new Set();
  for (const unit of matrix.filter((item) => item.browser === browser)) for (const suite of unit.tests) {
    const key = `${browser}:${suite}`;
    if (seenExecutions.has(key)) errors.push(`duplicate planned execution: ${key}`);
    browserSuites.add(suite);
    seenExecutions.add(key);
  }
  for (const suite of expectedSuites) if (!browserSuites.has(suite)) errors.push(`planned suite missing for browser: ${browser}:${suite}`);
}

const expectedExecutions = expectedBrowsers.reduce((count, browser) => count + matrix.filter((unit) => unit.browser === browser).reduce((sum, unit) => sum + unit.tests.length, 0), 0);
const observedExecutions = records.reduce((sum, item) => sum + item.record.executed_suites.length, 0);
const summary = {
  sha,
  plan_hash: planHash,
  expected_units: expectedByBrowserShard.size,
  observed_units: seenUnits.size,
  expected_suite_bindings: expectedExecutions,
  observed_suite_bindings: observedExecutions,
  failed: records.reduce((sum, item) => sum + Number(item.record.failed || 0), 0),
  skipped: records.reduce((sum, item) => sum + Number(item.record.skipped || 0), 0),
  unexpected: records.reduce((sum, item) => sum + Number(item.record.unexpected || 0), 0),
  result: errors.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
