#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIR, { recursive: true });

const iso = new Date().toISOString();
const hashFile = (path) => existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
const command = (name, args) => {
  const result = spawnSync(name, args, { cwd: ROOT, encoding: 'utf8' });
  return { exitCode: result.status ?? 1, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
};
const git = (args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; }
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'diagnostics') continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile()) out.push(relative(ROOT, path).replaceAll('\\', '/'));
  }
  return out;
}

const packageJson = resolve(ROOT, 'package.json');
const lockfile = resolve(ROOT, 'package-lock.json');
const nvmrc = resolve(ROOT, '.nvmrc');
const context = {
  schema: 'flixo-execution-context/v1',
  capturedAt: iso,
  execution: {
    sha: git(['rev-parse', 'HEAD']),
    branch: git(['branch', '--show-current']),
    commitTimestamp: git(['show', '-s', '--format=%cI', 'HEAD']),
    dirty: git(['status', '--porcelain']) !== '',
  },
  runtime: {
    node: process.version,
    npm: command('npm', ['--version']).stdout,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI === 'true',
    expectedSha: process.env.EXPECTED_SHA ?? null,
    testMode: process.env.FLIXO_TEST_MODE ?? null,
  },
  dependencies: {
    packageJsonSha256: hashFile(packageJson),
    packageLockSha256: hashFile(lockfile),
    nvmrcSha256: hashFile(nvmrc),
    lockfileVersion: existsSync(lockfile) ? JSON.parse(readFileSync(lockfile, 'utf8')).lockfileVersion ?? null : null,
    npmLs: command('npm', ['ls', '--all', '--json', '--depth=0']),
  },
  configuration: {},
  environment: Object.fromEntries(Object.keys(process.env).filter((key) => /^(CI|NODE|NPM|VITE|PLAYWRIGHT|FLIXO|EXPECTED_SHA|GITHUB_)/i.test(key)).sort().map((key) => [key, /TOKEN|SECRET|PASSWORD|KEY/i.test(key) ? '<REDACTED>' : process.env[key]])),
  inputs: {
    trackedFiles: command('git', ['ls-files']).stdout.split(/\r?\n/).filter(Boolean),
    relevantFiles: walk(resolve(ROOT, 'src')).concat(walk(resolve(ROOT, 'scripts')), walk(resolve(ROOT, 'tests')), walk(resolve(ROOT, '.github'))).slice(0, 5000),
  },
};

for (const path of ['tsconfig.json', 'vite.config.ts', 'playwright.config.ts', '.github/workflows/ci.yml', 'scripts/ci/root-causes.json']) {
  context.configuration[path] = hashFile(resolve(ROOT, path));
}

context.identityHash = createHash('sha256').update(JSON.stringify({
  execution: context.execution,
  runtime: context.runtime,
  dependencies: context.dependencies,
  configuration: context.configuration,
})).digest('hex');

writeFileSync(resolve(DIR, 'execution-context.json'), `${JSON.stringify(context, null, 2)}\n`);
console.log(`EXECUTION_CONTEXT_SHA=${context.execution.sha}`);
console.log(`EXECUTION_IDENTITY_HASH=${context.identityHash}`);
console.log(`PACKAGE_JSON_SHA256=${context.dependencies.packageJsonSha256}`);
console.log(`PACKAGE_LOCK_SHA256=${context.dependencies.packageLockSha256}`);
console.log(`TRACKED_INPUT_COUNT=${context.inputs.trackedFiles.length}`);
console.log(`RELEVANT_INPUT_COUNT=${context.inputs.relevantFiles.length}`);
