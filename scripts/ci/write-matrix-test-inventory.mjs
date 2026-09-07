import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const planPath = process.env.MATRIX_PLAN_PATH || 'matrix-plan.json';
const outputPath = process.env.MATRIX_TEST_INVENTORY_OUTPUT || 'matrix-test-inventory.json';
const sourceSha = process.env.FLIXO_SOURCE_SHA || process.env.EXACT_SHA || process.env.GITHUB_SHA || null;
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
if (!sourceSha) throw new Error('FLIXO_SOURCE_SHA/EXACT_SHA/GITHUB_SHA is required.');
if (plan?.source_sha !== sourceSha) throw new Error(`Matrix plan SHA mismatch: ${plan?.source_sha} != ${sourceSha}`);
if (!plan?.plan_hash || !Array.isArray(plan.matrix)) throw new Error('Matrix plan is incomplete.');

const collectTests = (value) => {
  const tests = [];
  const walkSuite = (suite) => {
    for (const spec of suite?.specs || []) {
      (spec.tests || []).forEach((test, index) => {
        tests.push({
          file: spec.file,
          title: spec.title,
          ordinal: index,
          id: `${spec.file}::${spec.title}::${index}`,
        });
      });
    }
    for (const child of suite?.suites || []) walkSuite(child);
  };
  for (const suite of value?.suites || []) walkSuite(suite);
  return tests;
};

const units = [];
for (const unit of plan.matrix) {
  const tests = [];
  for (const suite of unit.tests || []) {
    const output = execFileSync('npx', ['playwright', 'test', `tests/${suite}.spec.ts`, '--list', `--project=${unit.browser}`, '--reporter=json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, CI: '1' },
    });
    const listed = collectTests(JSON.parse(output));
    if (!listed.length) throw new Error(`No tests listed for ${unit.browser}/shard-${unit.shard}/${suite}`);
    tests.push(...listed);
  }
  const ids = tests.map((test) => test.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate test ID in ${unit.browser}/shard-${unit.shard}`);
  if (ids.length !== Number(unit.test_count)) throw new Error(`Inventory count mismatch for ${unit.browser}/shard-${unit.shard}: ${ids.length} != ${unit.test_count}`);
  units.push({
    browser: unit.browser,
    shard: unit.shard,
    suites: [...unit.tests].sort(),
    test_count: ids.length,
    tests,
  });
}

const artifact = {
  schema_version: 1,
  source_sha: sourceSha,
  plan_hash: plan.plan_hash,
  units,
};
artifact.inventory_hash = createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ source_sha: sourceSha, plan_hash: plan.plan_hash, inventory_hash: artifact.inventory_hash, units: units.length, tests: units.reduce((sum, unit) => sum + unit.test_count, 0) }, null, 2));
