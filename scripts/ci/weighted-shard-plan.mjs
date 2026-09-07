import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const historyPath = 'ci/test-duration-history.json';
const history = JSON.parse(readFileSync(historyPath, 'utf8'));
const requested = Number(process.env.CI_SHARD_COUNT || history.shardBudget.default);
const maximum = Number(process.env.CI_MAX_SHARDS || history.shardBudget.maximum);
const reserve = Number(process.env.CI_RUNNER_RESERVE || history.shardBudget.reserve);
const runnerBudget = Math.max(1, Number(process.env.CI_RUNNER_BUDGET || Math.max(1, requested + reserve)) - reserve);
const shardCount = Math.max(1, Math.min(requested, maximum, runnerBudget));
const browsers = (process.env.CI_BROWSERS || 'chromium,firefox,webkit').split(',').map((value) => value.trim()).filter(Boolean);
const entries = Object.entries(history.tests).map(([name, value]) => ({ name, weight: Math.max(1, Number(value.weight) || 1) }));
const sourceSha = process.env.FLIXO_SOURCE_SHA || process.env.GITHUB_SHA || null;
if (!sourceSha) throw new Error('FLIXO_SOURCE_SHA/GITHUB_SHA is required.');
if (!entries.length) throw new Error('No test weights configured.');
if (!browsers.length) throw new Error('No browsers configured.');

const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const normalizeTestFile = (file) => {
  const normalized = String(file).replace(/\\/g, '/');
  const marker = '/tests/';
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) return normalized.slice(index + 1);
  return normalized.replace(/^\.\//, '');
};
const testId = (spec, test, ordinal) => `${normalizeTestFile(spec.file)}::${spec.title}::${ordinal}`;
const collectListedTests = (value) => {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite?.specs || []) {
      for (const [ordinal, test] of (spec.tests || []).entries()) {
        tests.push({ id: testId(spec, test, ordinal), file: normalizeTestFile(spec.file), title: spec.title, ordinal });
      }
    }
    for (const child of suite?.suites || []) walk(child);
  };
  for (const suite of value?.suites || []) walk(suite);
  return tests;
};

execFileSync('node', ['--experimental-strip-types', 'scripts/ci/validate-protocol-cooperation.mjs'], { stdio: 'inherit', env: { ...process.env, FLIXO_SOURCE_SHA: sourceSha, CI: '1' } });
const cooperationMap = JSON.parse(readFileSync('artifacts/ci/protocol-cooperation/cooperation-map.json', 'utf8'));
const cooperationMapHash = createHash('sha256').update(JSON.stringify(cooperationMap)).digest('hex');
const registryHash = hashFile('scripts/ci/contracts/registry.ts');
const architectureHash = hashFile('scripts/ci/validate-architecture.mjs');
const lockfileHash = hashFile('package-lock.json');

const total = entries.reduce((sum, item) => sum + item.weight, 0);
const bins = Array.from({ length: shardCount }, (_, index) => ({ shard: index + 1, weight: 0, tests: [] }));
for (const item of [...entries].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))) {
  bins.sort((a, b) => a.weight - b.weight || a.shard - b.shard);
  bins[0].tests.push(item.name);
  bins[0].weight += item.weight;
}

const plan = bins.filter((bin) => bin.tests.length).map((bin) => ({
  ...bin,
  ratio: Number((bin.weight / total).toFixed(4)),
}));
const spread = Math.max(...plan.map((bin) => bin.weight)) - Math.min(...plan.map((bin) => bin.weight));
if (spread > Math.max(2, Math.ceil(total / shardCount))) throw new Error(`Shard plan is too imbalanced: spread=${spread}, total=${total}, shards=${shardCount}`);

const suiteInventory = new Map();
for (const entry of entries) {
  const output = execFileSync('npx', ['playwright', 'test', `tests/${entry.name}.spec.ts`, '--list', '--project=chromium', '--reporter=json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, CI: '1' },
  });
  const report = JSON.parse(output);
  const tests = collectListedTests(report);
  if (!tests.length) throw new Error(`Unable to determine Playwright tests for ${entry.name}`);
  const ids = tests.map((test) => test.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate Playwright test IDs for ${entry.name}`);
  suiteInventory.set(entry.name, { count: tests.length, test_ids: ids });
}

for (const bin of plan) {
  bin.test_count = bin.tests.reduce((sum, suite) => sum + suiteInventory.get(suite).count, 0);
  bin.test_ids = bin.tests.flatMap((suite) => suiteInventory.get(suite).test_ids);
  if (new Set(bin.test_ids).size !== bin.test_ids.length) throw new Error(`Duplicate planned test IDs in shard-${bin.shard}`);
}

const allSuites = plan.flatMap((bin) => bin.tests);
if (JSON.stringify([...allSuites].sort()) !== JSON.stringify([...Object.keys(history.tests)].sort())) {
  throw new Error('Weighted matrix plan does not cover every configured suite exactly once.');
}

const matrix = plan.flatMap((bin) => browsers.map((browser) => ({
  browser,
  shard: bin.shard,
  total_shards: plan.length,
  tests: bin.tests,
  test_count: bin.test_count,
  test_ids: [...bin.test_ids],
  weight: bin.weight,
})));

const unsignedPlan = {
  schema_version: 4,
  source_sha: sourceSha,
  registry_hash: registryHash,
  cooperation_map_hash: cooperationMapHash,
  architecture_hash: architectureHash,
  lockfile_sha: lockfileHash,
  cooperation_contract_count: cooperationMap.contractCount,
  browsers,
  shard_count: plan.length,
  suites: Object.keys(history.tests).sort(),
  plan,
  matrix,
};
const canonical = JSON.stringify(unsignedPlan);
const planHash = createHash('sha256').update(canonical).digest('hex');
const signingKey = process.env.FLIXO_MATRIX_PLAN_SIGNING_KEY;
if (!signingKey) throw new Error('FLIXO_MATRIX_PLAN_SIGNING_KEY is required to sign the matrix plan.');
const signature = createHmac('sha256', signingKey).update(canonical).digest('hex');
const artifact = { ...unsignedPlan, plan_hash: planHash, signature_algorithm: 'HMAC-SHA256', signature };
writeFileSync('_flixo_matrix_plan.json', JSON.stringify(artifact, null, 2) + '\n');

const output = JSON.stringify(matrix);
console.log(JSON.stringify({ plan, matrix, plan_hash: planHash, registry_hash: registryHash, cooperation_map_hash: cooperationMapHash, architecture_hash: architectureHash, lockfile_sha: lockfileHash, plan_file: '_flixo_matrix_plan.json' }, null, 2));
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `plan=${JSON.stringify(plan)}\nshard_count=${plan.length}\nmatrix=${output}\nplan_hash=${planHash}\nplan_file=_flixo_matrix_plan.json\n`);
}
