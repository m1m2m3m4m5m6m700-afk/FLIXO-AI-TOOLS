#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const target = path.join(root, 'src/routes/home-page.tsx');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/critical-mutations.json'), 'utf8'));
const original = fs.readFileSync(target, 'utf8');
const mutations = [
  {
    id: 'MUT-BROWSER-001',
    replacement: ['<main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction}>', '<div className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction}>'],
    project: 'chromium',
    grep: 'production-like home boots with a single primary landmark',
  },
  {
    id: 'MUT-BROWSER-002',
    replacement: ['<main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction}>', '<main className="home-shell" lang={localeMetadata.languageTag} dir="ltr">'],
    project: 'firefox',
    grep: 'localized home preserves language and direction contracts',
  },
  {
    id: 'MUT-BROWSER-003',
    replacement: ['id="home-title"', 'id="home-title-mutated"'],
    project: 'chromium',
    grep: 'production-like home boots with a single primary landmark',
  },
];

if (!Array.isArray(registry.mutations)) throw new Error('critical mutation registry is malformed');
const registryIds = registry.mutations.map((mutation) => mutation.id);
const runnerIds = mutations.map((mutation) => mutation.id);
if (registryIds.length !== runnerIds.length || registryIds.some((id, index) => id !== runnerIds[index])) {
  throw new Error(`mutation registry/runner mismatch: registry=${registryIds.join(',')} runner=${runnerIds.join(',')}`);
}

const run = (command, args, env = {}) => spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, ...env },
  encoding: 'utf8',
  stdio: 'inherit',
});

const results = [];
try {
  for (const mutation of mutations) {
    fs.writeFileSync(target, original);
    const [needle, replacement] = mutation.replacement;
    if (!fs.readFileSync(target, 'utf8').includes(needle)) throw new Error(`${mutation.id}: mutation target not found`);
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(needle, replacement));

    const build = run('npm', ['run', 'build:runtime']);
    if (build.status !== 0) throw new Error(`${mutation.id}: mutated build failed before the test could execute`);

    const test = run('npx', ['playwright', 'test', 'tests/universal-diagnostic-browser.spec.ts', '--project=' + mutation.project, '--grep=' + mutation.grep, '--workers=1', '--retries=0', '--max-failures=1']);
    const killed = test.status !== 0;
    results.push({ id: mutation.id, project: mutation.project, status: killed ? 'KILLED' : 'SURVIVED' });
    if (!killed) throw new Error(`${mutation.id}: critical mutation SURVIVED`);
  }
} finally {
  fs.writeFileSync(target, original);
  if (fs.readFileSync(target, 'utf8') !== original) throw new Error('mutation harness failed to restore the target source');
}

console.log(JSON.stringify({
  schema_version: 1,
  authority: 'CRITICAL_MUTATION_EFFECTIVENESS',
  status: 'PASS',
  total: results.length,
  killed: results.filter((r) => r.status === 'KILLED').length,
  survived: results.filter((r) => r.status === 'SURVIVED').length,
  results,
}, null, 2));
