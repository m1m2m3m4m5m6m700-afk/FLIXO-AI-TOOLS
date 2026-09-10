#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/critical-mutations.json'), 'utf8'));

if (!Array.isArray(registry.mutations) || registry.mutations.length === 0) {
  throw new Error('critical mutation registry is malformed or empty');
}

const mutations = registry.mutations;
const ids = mutations.map((mutation) => mutation.id);
if (ids.some((id) => typeof id !== 'string' || !id)) throw new Error('critical mutation registry contains an invalid id');
if (new Set(ids).size !== ids.length) throw new Error('critical mutation registry contains duplicate ids');

for (const mutation of mutations) {
  if (!mutation.target_file || !mutation.project || !mutation.grep || !Array.isArray(mutation.replacement) || mutation.replacement.length !== 2) {
    throw new Error(`${mutation.id}: executable mutation definition is incomplete`);
  }
  if (!/^src\//.test(mutation.target_file)) throw new Error(`${mutation.id}: mutation target must be inside src/`);
}

const run = (command, args, env = {}) => spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, ...env },
  encoding: 'utf8',
  stdio: 'inherit',
});

const results = [];
for (const mutation of mutations) {
  const target = path.join(root, mutation.target_file);
  if (!fs.existsSync(target)) throw new Error(`${mutation.id}: mutation target does not exist: ${mutation.target_file}`);
  const original = fs.readFileSync(target, 'utf8');
  const [needle, replacement] = mutation.replacement;
  let restored = false;

  try {
    if (!original.includes(needle)) throw new Error(`${mutation.id}: mutation target not found`);
    fs.writeFileSync(target, original.replace(needle, replacement));

    const mutated = fs.readFileSync(target, 'utf8');
    if (mutated === original) throw new Error(`${mutation.id}: mutation produced no source change`);

    const build = run('npm', ['run', 'build:runtime']);
    if (build.status !== 0) throw new Error(`${mutation.id}: mutated build failed before the test could execute`);

    const test = run('npx', [
      'playwright',
      'test',
      'tests/universal-diagnostic-browser.spec.ts',
      '--project=' + mutation.project,
      '--grep=' + mutation.grep,
      '--workers=1',
      '--retries=0',
      '--max-failures=1',
    ]);
    const killed = test.status !== 0;
    results.push({
      id: mutation.id,
      owner: mutation.owner,
      target: mutation.target,
      project: mutation.project,
      status: killed ? 'KILLED' : 'SURVIVED',
    });
    if (!killed) throw new Error(`${mutation.id}: critical mutation SURVIVED`);
  } finally {
    fs.writeFileSync(target, original);
    restored = fs.readFileSync(target, 'utf8') === original;
  }

  if (!restored) throw new Error(`${mutation.id}: mutation harness failed to restore ${mutation.target_file}`);
}

const killed = results.filter((result) => result.status === 'KILLED').length;
const survived = results.filter((result) => result.status === 'SURVIVED').length;
const evidence = {
  schema_version: 2,
  authority: 'CRITICAL_MUTATION_EFFECTIVENESS',
  status: survived === 0 && killed === mutations.length ? 'PASS' : 'FAIL',
  total: results.length,
  killed,
  survived,
  results,
};

const evidencePath = path.join(root, 'diagnostics', 'certification', 'critical-mutation-effectiveness.json');
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== 'PASS') process.exit(1);
