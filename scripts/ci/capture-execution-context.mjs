#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
mkdirSync(OUT, { recursive: true });
const hashFile = (file) => existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null;
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }); return { exitCode: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() }; };
const git = (args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } };
const context = {
  schema: 'flixo-execution-context/v1',
  capturedAt: new Date().toISOString(),
  execution: { sha: git(['rev-parse','HEAD']), branch: git(['branch','--show-current']), commitTimestamp: git(['show','-s','--format=%cI','HEAD']), dirty: git(['status','--porcelain']) !== '' },
  runtime: { node: process.version, npm: run('npm',['--version']).stdout, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', expectedSha: process.env.EXPECTED_SHA ?? null, testMode: process.env.FLIXO_TEST_MODE ?? null },
  dependencies: { packageJsonSha256: hashFile(resolve(ROOT,'package.json')), packageLockSha256: hashFile(resolve(ROOT,'package-lock.json')), nvmrcSha256: hashFile(resolve(ROOT,'.nvmrc')), lockfileVersion: existsSync(resolve(ROOT,'package-lock.json')) ? JSON.parse(readFileSync(resolve(ROOT,'package-lock.json'),'utf8')).lockfileVersion ?? null : null, npmLs: run('npm',['ls','--all','--json','--depth=0']) },
  configuration: Object.fromEntries(['tsconfig.json','vite.config.ts','playwright.config.ts','.github/workflows/ci.yml','scripts/ci/test-plan.json','scripts/ci/root-causes.json'].map((p) => [p, hashFile(resolve(ROOT,p))])),
  inputs: { trackedFiles: run('git',['ls-files']).stdout.split(/\r?\n/).filter(Boolean), relevantFiles: [] },
};
context.identityHash = createHash('sha256').update(JSON.stringify({execution:context.execution,runtime:context.runtime,dependencies:context.dependencies,configuration:context.configuration})).digest('hex');
writeFileSync(resolve(OUT,'execution-context.json'), `${JSON.stringify(context,null,2)}\n`);
console.log(`EXECUTION_CONTEXT_SHA=${context.execution.sha}`);
console.log(`EXECUTION_IDENTITY_HASH=${context.identityHash}`);
console.log(`PACKAGE_JSON_SHA256=${context.dependencies.packageJsonSha256}`);
console.log(`PACKAGE_LOCK_SHA256=${context.dependencies.packageLockSha256}`);
console.log(`TRACKED_INPUT_COUNT=${context.inputs.trackedFiles.length}`);
console.log(`RELEVANT_INPUT_COUNT=${context.inputs.relevantFiles.length}`);
