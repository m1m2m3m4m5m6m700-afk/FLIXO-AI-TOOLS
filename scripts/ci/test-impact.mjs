#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
const MAP_PATH = resolve(ROOT, 'scripts/ci/test-impact-map.json');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const baseArg = args.find((a) => a.startsWith('--base='))?.slice(7) ?? null;
const mode = args.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'pr';
const execute = args.includes('--execute');
const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const head = git(['rev-parse', 'HEAD']);
const base = baseArg ?? (mode === 'release' ? head : git(['rev-parse', 'HEAD^']));
const files = mode === 'release' ? ['<release>'] : git(['diff', '--name-only', `${base}...${head}`]).split(/\r?\n/).filter(Boolean);

const globToRegExp = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '<<<DOUBLE>>>').replace(/\*/g, '[^/]*').replace(/<<<DOUBLE>>>/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
};
const matches = (file, pattern) => globToRegExp(pattern).test(file);

const matchedDomains = new Map();
for (const file of files) {
  if (file === '<release>') continue;
  for (const rule of map.rules) {
    if (rule.patterns.some((pattern) => matches(file, pattern))) {
      if (!matchedDomains.has(rule.domain)) matchedDomains.set(rule.domain, { ...rule, files: [] });
      matchedDomains.get(rule.domain).files.push(file);
    }
  }
}

const unknownFiles = files.filter((file) => ![...matchedDomains.values()].some((rule) => rule.files.includes(file)));
const forceFull = mode === 'release' || unknownFiles.length > 0 || matchedDomains.size === 0;
const domains = forceFull ? [{ domain: 'full', tier: 'full', files, commands: ['npm run test:static', 'npm run test:build', 'npm run test:browser'] }] : [...matchedDomains.values()];
const tierOrder = ['smoke', 'unit', 'contract', 'e2e', 'full'];
const tier = domains.reduce((max, d) => tierOrder.indexOf(d.tier) > tierOrder.indexOf(max) ? d.tier : max, 'smoke');
const commands = [...new Set(domains.flatMap((d) => d.commands))];
const plan = {
  schema: 'flixo-test-impact/v1',
  evidenceClass: 'PRIMARY_EXECUTION',
  mode,
  base,
  sha: head,
  changedFiles: files,
  unknownFiles,
  forceFull,
  tier,
  domains: domains.map(({ domain, tier, files: matched }) => ({ domain, tier, files: matched })),
  commands,
  impactMapSha256: createHash('sha256').update(readFileSync(MAP_PATH)).digest('hex'),
  generatedAt: new Date().toISOString(),
};

writeFileSync(resolve(OUT, 'test-impact.json'), `${JSON.stringify(plan, null, 2)}\n`);
console.log(`IMPACT_TIER=${tier}`);
console.log(`IMPACT_DOMAINS=${domains.map((d) => d.domain).join(',')}`);
console.log(`IMPACT_FORCE_FULL=${forceFull}`);
console.log(`IMPACT_COMMANDS=${commands.length}`);

if (!execute) process.exit(0);

const maxConcurrency = Number(process.env.IMPACT_MAX_CONCURRENCY ?? 6);
if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 16) {
  throw new Error(`Invalid IMPACT_MAX_CONCURRENCY: ${maxConcurrency}`);
}

const isInstall = (command) => /^npm\s+(ci|install)(?:\s|$)/.test(command);
const isBrowser = (command) => /^npm\s+run\s+test:browser(?:\s|$)/.test(command);
const run = (command) => new Promise((resolveResult) => {
  const [program, ...parts] = command.split(/\s+/);
  const startedAt = new Date().toISOString();
  const child = spawn(program, parts, { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  let output = '';
  child.stdout.on('data', (data) => { const text = data.toString(); output += text; process.stdout.write(text); });
  child.stderr.on('data', (data) => { const text = data.toString(); output += text; process.stderr.write(text); });
  child.on('error', (error) => resolveResult({ command, status: 'FAIL', exitCode: 1, startedAt, completedAt: new Date().toISOString(), output: `${output}\n${error.message}`.slice(-24000) }));
  child.on('close', (code) => resolveResult({ command, status: code === 0 ? 'PASS' : 'FAIL', exitCode: code ?? 1, startedAt, completedAt: new Date().toISOString(), output: output.slice(-24000) }));
});

const results = [];
const installations = commands.filter(isInstall);
const browserVerification = commands.filter(isBrowser);
const verification = commands.filter((command) => !isInstall(command) && !isBrowser(command));

// Package installation mutates node_modules, so it is deliberately serialized before
// verification. Browser verification is a separate exclusive phase: Playwright's
// webServer owns a fixed local port and must not race with build/static verification.
for (const command of installations) {
  const result = await run(command);
  results.push(result);
  if (result.status !== 'PASS') break;
}

if (!results.some((r) => r.status === 'FAIL')) {
  for (let i = 0; i < verification.length; i += maxConcurrency) {
    const batch = verification.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(batch.map(run));
    results.push(...batchResults);
    if (batchResults.some((r) => r.status !== 'PASS')) break;
  }
}

if (!results.some((r) => r.status === 'FAIL')) {
  for (const command of browserVerification) {
    const result = await run(command);
    results.push(result);
    if (result.status !== 'PASS') break;
  }
}

const execution = {
  ...plan,
  executionMaxConcurrency: maxConcurrency,
  executionStrategy: installations.length ? 'install-then-bounded-parallel-non-browser-then-exclusive-browser' : 'bounded-parallel-non-browser-then-exclusive-browser',
  status: results.every((r) => r.status === 'PASS') && results.length === commands.length ? 'PASS' : 'FAIL',
  results,
  completedAt: new Date().toISOString(),
};
writeFileSync(resolve(OUT, 'test-impact-execution.json'), `${JSON.stringify(execution, null, 2)}\n`);
if (execution.status !== 'PASS') process.exitCode = 1;
