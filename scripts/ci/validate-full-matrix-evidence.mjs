import { createHash, createHmac } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'full-matrix-evidence';
const planPath = process.env.MATRIX_PLAN_PATH || join(root, '_flixo_matrix_plan.json');
const inventoryPath = process.env.MATRIX_TEST_INVENTORY_PATH || 'matrix-test-inventory.json';
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
const signingKey = process.env.FLIXO_MATRIX_PLAN_SIGNING_KEY;

if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');
if (!signingKey) throw new Error('FLIXO_MATRIX_PLAN_SIGNING_KEY is required.');
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing full matrix evidence directory: ${root}`);
if (!statSync(planPath, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing immutable matrix plan: ${planPath}`);
if (!statSync(inventoryPath, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing immutable test inventory: ${inventoryPath}`);

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const { plan_hash: planHash, signature, signature_algorithm: signatureAlgorithm, ...unsignedPlan } = plan;
if (!planHash || !signature || signatureAlgorithm !== 'HMAC-SHA256') throw new Error('Matrix plan signature metadata is invalid.');
if (plan.schema_version !== 3) throw new Error(`Unsupported matrix plan schema_version=${plan.schema_version}`);
const canonical = JSON.stringify(unsignedPlan);
const computedHash = createHash('sha256').update(canonical).digest('hex');
const computedSignature = createHmac('sha256', signingKey).update(canonical).digest('hex');
if (computedHash !== planHash) throw new Error(`Matrix plan hash mismatch: ${computedHash} != ${planHash}`);
if (computedSignature !== signature) throw new Error('Matrix plan signature mismatch.');
if (plan.source_sha !== sha) throw new Error(`Matrix plan SHA mismatch: ${plan.source_sha} != ${sha}`);
for (const [label, path, field] of [
  ['registry', 'scripts/ci/contracts/registry.ts', 'registry_hash'],
  ['architecture', 'scripts/ci/validate-architecture.mjs', 'architecture_hash'],
  ['lockfile', 'package-lock.json', 'lockfile_sha'],
]) {
  if (!plan[field]) throw new Error(`Matrix plan missing ${field}`);
  const actual = sha256File(path);
  if (actual !== plan[field]) throw new Error(`${label} provenance hash mismatch: ${actual} != ${plan[field]}`);
}

const expectedBrowsers = plan.browsers;
const expectedShards = Number(plan.shard_count);
const matrix = plan.matrix;
if (!Array.isArray(expectedBrowsers) || expectedBrowsers.length === 0) throw new Error('Matrix plan has no browsers.');
if (!Number.isInteger(expectedShards) || expectedShards < 1) throw new Error('Matrix plan has invalid shard_count.');
if (!Array.isArray(matrix) || matrix.length !== expectedBrowsers.length * expectedShards) throw new Error('Matrix plan matrix cardinality is invalid.');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
if (inventory.schema_version !== 1 || inventory.source_sha !== sha || inventory.plan_hash !== planHash) throw new Error('Matrix test inventory provenance mismatch.');
const recomputedInventoryHash = createHash('sha256').update(JSON.stringify({ schema_version: inventory.schema_version, source_sha: inventory.source_sha, plan_hash: inventory.plan_hash, units: inventory.units })).digest('hex');
if (inventory.inventory_hash !== recomputedInventoryHash) throw new Error('Matrix test inventory hash mismatch.');

const expectedByBrowserShard = new Map();
for (const unit of matrix) {
  const key = `${unit.browser}:${unit.shard}`;
  if (expectedByBrowserShard.has(key)) throw new Error(`Duplicate plan unit: ${key}`);
  if (!expectedBrowsers.includes(unit.browser)) throw new Error(`Unknown planned browser: ${unit.browser}`);
  if (!Number.isInteger(unit.shard) || unit.shard < 1 || unit.shard > expectedShards) throw new Error(`Invalid planned shard: ${key}`);
  if (!Array.isArray(unit.tests) || unit.tests.length === 0) throw new Error(`Empty planned suite set: ${key}`);
  if (!Number.isInteger(unit.test_count) || unit.test_count < 1) throw new Error(`Invalid planned test count: ${key}`);
  const inv = inventory.units?.find((item) => item.browser === unit.browser && Number(item.shard) === Number(unit.shard));
  if (!inv) throw new Error(`Missing inventory unit: ${key}`);
  if (inv.plan_hash !== undefined && inv.plan_hash !== planHash) throw new Error(`Inventory unit ${key} has wrong plan hash`);
  const invIds = (inv.tests || []).map((test) => test.id).sort();
  if (invIds.length !== Number(unit.test_count) || new Set(invIds).size !== invIds.length) throw new Error(`Inventory unit ${key} has invalid test IDs/count`);
  if (JSON.stringify([...unit.tests].sort()) !== JSON.stringify([...inv.suites].sort())) throw new Error(`Inventory suites differ from plan: ${key}`);
  expectedByBrowserShard.set(key, unit);
}
if ((inventory.units || []).length !== expectedByBrowserShard.size) throw new Error('Inventory unit cardinality differs from matrix plan.');

const files = readdirSync(root).filter((name) => name.endsWith('.json') && !name.endsWith('-playwright-results.json'));
const errors = [];
const records = [];
const seenUnits = new Set();

const collectNativeTests = (report) => {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const [index, test] of (spec.tests || []).entries()) tests.push({ file: spec.file, title: spec.title, ordinal: index, status: test.status, results: test.results || [] });
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of report.suites || []) walk(suite);
  return tests;
};
const normalizeSuite = (file) => file.replace(/^.*[\\/]tests[\\/]/, '').replace(/\.spec\.ts$/, '');

for (const fileName of files) {
  const file = join(root, fileName);
  const record = JSON.parse(readFileSync(file, 'utf8'));
  records.push({ file, record });
  for (const key of ['schema_version', 'sha', 'plan_hash', 'inventory_hash', 'browser', 'shard', 'planned_suites', 'executed_suites', 'planned_test_count', 'observed_test_count', 'failed', 'skipped', 'unexpected', 'flaky', 'native_report_path', 'native_report_sha256', 'planned_test_ids', 'observed_test_ids']) if (!(key in record)) errors.push(`${file} missing ${key}`);
  if (record.schema_version !== 1) errors.push(`${file} schema_version=${record.schema_version} != 1`);
  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (record.plan_hash !== planHash) errors.push(`${file} plan hash mismatch: ${record.plan_hash} != ${planHash}`);
  if (record.inventory_hash !== inventory.inventory_hash) errors.push(`${file} inventory hash mismatch`);
  if (Number(record.failed) !== 0 || Number(record.skipped) !== 0 || Number(record.unexpected) !== 0 || Number(record.flaky) !== 0) errors.push(`${file} nonzero result counts`);
  if (!Number.isInteger(record.planned_test_count) || !Number.isInteger(record.observed_test_count)) errors.push(`${file} test counts must be integers`);
  if (record.planned_test_count !== record.observed_test_count) errors.push(`${file} planned_test_count=${record.planned_test_count} != observed_test_count=${record.observed_test_count}`);
  const unitKey = `${record.browser}:${record.shard}`;
  const unit = expectedByBrowserShard.get(unitKey);
  if (!unit) errors.push(`${file} is not present in immutable plan: ${unitKey}`);
  else {
    const inv = inventory.units.find((item) => item.browser === record.browser && Number(item.shard) === Number(record.shard));
    if (!inv) errors.push(`${file} missing inventory unit`);
    else if (JSON.stringify([...inv.tests].map((test) => test.id).sort()) !== JSON.stringify([...(record.planned_test_ids || [])].sort())) errors.push(`${file} planned IDs differ from immutable inventory`);
    if (seenUnits.has(unitKey)) errors.push(`duplicate evidence unit: ${unitKey}`);
    seenUnits.add(unitKey);
    if (JSON.stringify([...unit.tests].sort()) !== JSON.stringify([...record.planned_suites].sort())) errors.push(`${file} evidence planned suites differ from plan`);
    if (JSON.stringify([...unit.tests].sort()) !== JSON.stringify([...record.executed_suites].sort())) errors.push(`${file} planned suite != executed suite`);
    if (record.planned_test_count !== Number(unit.test_count)) errors.push(`${file} planned_test_count=${record.planned_test_count} != plan=${unit.test_count}`);
    if (!record.native_report_path || record.native_report_path.includes('/') || record.native_report_path.includes('\\')) errors.push(`${file} native_report_path must be a basename`);
    const nativePath = join(root, record.native_report_path);
    if (!statSync(nativePath, { throwIfNoEntry: false })?.isFile()) errors.push(`${file} missing native report ${record.native_report_path}`);
    else {
      const nativeText = readFileSync(nativePath, 'utf8');
      const nativeHash = createHash('sha256').update(nativeText).digest('hex');
      if (record.native_report_sha256 !== nativeHash) errors.push(`${file} native report SHA mismatch`);
      const native = JSON.parse(nativeText);
      const nativeTests = collectNativeTests(native);
      const nativeSuites = [...new Set(nativeTests.map((test) => normalizeSuite(test.file)))].sort();
      const nativeIds = nativeTests.map((test) => `${test.file}::${test.title}::${test.ordinal}`).sort();
      const nativeObserved = nativeTests.length;
      const nativeSkipped = nativeTests.filter((test) => test.status === 'skipped').length;
      const nativeUnexpected = nativeTests.filter((test) => test.status === 'unexpected').length;
      const nativeFlaky = nativeTests.filter((test) => test.status === 'flaky').length;
      if (JSON.stringify(nativeIds) !== JSON.stringify([...(record.observed_test_ids || [])].sort())) errors.push(`${file} native test IDs differ from evidence`);
      if (nativeObserved !== record.observed_test_count) errors.push(`${file} native observed count mismatch`);
      if (nativeObserved !== unit.test_count) errors.push(`${file} native observed count != plan`);
      if (JSON.stringify(nativeSuites) !== JSON.stringify([...unit.tests].sort())) errors.push(`${file} native suites != plan`);
      if (nativeSkipped !== 0 || nativeUnexpected !== 0 || nativeFlaky !== 0) errors.push(`${file} native report is not clean`);
      if (Number(native.stats?.skipped || 0) !== 0 || Number(native.stats?.unexpected || 0) !== 0 || Number(native.stats?.flaky || 0) !== 0) errors.push(`${file} native stats are not clean`);
    }
  }
}

for (const key of expectedByBrowserShard.keys()) if (!seenUnits.has(key)) errors.push(`missing evidence unit: ${key}`);
const plannedBindings = matrix.reduce((sum, unit) => sum + unit.tests.length, 0) * expectedBrowsers.length;
const observedBindings = records.reduce((sum, item) => sum + item.record.executed_suites.length, 0);
const plannedTests = matrix.reduce((sum, unit) => sum + Number(unit.test_count), 0) * expectedBrowsers.length;
const observedTests = records.reduce((sum, item) => sum + Number(item.record.observed_test_count), 0);
const summary = { sha, plan_hash: planHash, inventory_hash: inventory.inventory_hash, expected_units: expectedByBrowserShard.size, observed_units: seenUnits.size, planned_suite_bindings: plannedBindings, observed_suite_bindings: observedBindings, planned_tests: plannedTests, observed_tests: observedTests, failed: records.reduce((sum, item) => sum + Number(item.record.failed || 0), 0), skipped: records.reduce((sum, item) => sum + Number(item.record.skipped || 0), 0), unexpected: records.reduce((sum, item) => sum + Number(item.record.unexpected || 0), 0), result: errors.length ? 'FAIL' : 'PASS' };
console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
