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
if (!entries.length) throw new Error('No test weights configured.');
if (!browsers.length) throw new Error('No browsers configured.');

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

const countListedTests = (value) => {
  if (!value || typeof value !== 'object') return 0;
  const specs = Array.isArray(value.specs) ? value.specs : [];
  const direct = specs.reduce((sum, spec) => sum + (Array.isArray(spec.tests) ? spec.tests.length : 0), 0);
  const children = Array.isArray(value.suites) ? value.suites.reduce((sum, suite) => sum + countListedTests(suite), 0) : 0;
  return direct + children;
};

const suiteCount = new Map();
for (const entry of entries) {
  const output = execFileSync('npx', ['playwright', 'test', `tests/${entry.name}.spec.ts`, '--list', '--project=chromium', '--reporter=json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, CI: '1' } });
  const report = JSON.parse(output);
  const count = countListedTests({ suites: report.suites });
  if (!Number.isInteger(count) || count < 1) throw new Error(`Unable to determine Playwright test count for ${entry.name}`);
  suiteCount.set(entry.name, count);
}

for (const bin of plan) bin.test_count = bin.tests.reduce((sum, suite) => sum + suiteCount.get(suite), 0);

const matrix = plan.flatMap((bin) => browsers.map((browser) => ({
  browser,
  shard: bin.shard,
  total_shards: plan.length,
  tests: bin.tests,
  test_count: bin.test_count,
  weight: bin.weight,
})));

const unsignedPlan = {
  schema_version: 2,
  source_sha: process.env.FLIXO_SOURCE_SHA || process.env.GITHUB_SHA || null,
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
writeFileSync('matrix-plan.json', JSON.stringify(artifact, null, 2) + '\n');

const output = JSON.stringify(matrix);
console.log(JSON.stringify({ plan, matrix, plan_hash: planHash }, null, 2));
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `plan=${JSON.stringify(plan)}\nshard_count=${plan.length}\nmatrix=${output}\nplan_hash=${planHash}\n`);
}
