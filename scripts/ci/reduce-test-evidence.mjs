#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
const inputPath = resolve(ROOT, process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'diagnostics/ci/test-impact-execution.json');
const outputPath = resolve(ROOT, process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'diagnostics/ci/test-evidence.json');

const fail = (message) => {
  console.error(`EVIDENCE_REDUCER_ERROR=${message}`);
  process.exit(1);
};

if (!existsSync(inputPath)) fail(`missing input: ${inputPath}`);
const input = JSON.parse(readFileSync(inputPath, 'utf8'));

const required = ['schema', 'evidenceClass', 'sha', 'base', 'impactMapSha256', 'tier', 'domains', 'commands', 'status', 'results'];
for (const key of required) if (!(key in input)) fail(`missing field: ${key}`);
if (input.schema !== 'flixo-test-impact/v1') fail(`unsupported schema: ${input.schema}`);
if (input.evidenceClass !== 'PRIMARY_EXECUTION') fail('evidence class must be PRIMARY_EXECUTION');
if (!/^[0-9a-f]{40}$/.test(input.sha)) fail('invalid execution SHA');
if (!/^[0-9a-f]{40}$/.test(input.base)) fail('invalid base SHA');
if (!/^[0-9a-f]{64}$/.test(input.impactMapSha256)) fail('invalid impact map hash');
if (!Array.isArray(input.commands) || input.commands.length === 0) fail('commands must be non-empty');
if (!Array.isArray(input.results)) fail('results must be an array');

const expected = new Map(input.commands.map((command) => [command, 'PENDING']));
for (const result of input.results) {
  if (!result || typeof result.command !== 'string' || !['PASS', 'FAIL', 'BLOCKED'].includes(result.status)) fail('invalid result entry');
  if (!expected.has(result.command)) fail(`unexpected result command: ${result.command}`);
  if (expected.get(result.command) !== 'PENDING') fail(`duplicate result command: ${result.command}`);
  expected.set(result.command, result.status);
}
const missing = [...expected.entries()].filter(([, status]) => status === 'PENDING').map(([command]) => command);
const failed = input.results.filter((result) => result.status === 'FAIL').map((result) => result.command);
const blocked = input.results.filter((result) => result.status === 'BLOCKED').map((result) => result.command);
const pass = missing.length === 0 && failed.length === 0 && blocked.length === 0 && input.status === 'PASS';
const state = missing.length > 0 ? 'BLOCKED' : failed.length > 0 ? 'FAIL' : blocked.length > 0 ? 'BLOCKED' : pass ? 'PASS' : 'FAIL';

const evidence = {
  schema: 'flixo-test-evidence/v1',
  evidenceClass: 'PRIMARY_EXECUTION',
  state,
  executionSha: input.sha,
  baseSha: input.base,
  impactMapSha256: input.impactMapSha256,
  impactTier: input.tier,
  domains: input.domains,
  plannedCommands: input.commands,
  completedCommands: input.results.map((result) => result.command),
  missingCommands: missing,
  failedCommands: failed,
  blockedCommands: blocked,
  resultCount: input.results.length,
  commandCount: input.commands.length,
  sourceSha256: createHash('sha256').update(readFileSync(inputPath)).digest('hex'),
  generatedAt: new Date().toISOString(),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`EVIDENCE_STATE=${state}`);
console.log(`EVIDENCE_SHA=${input.sha}`);
console.log(`EVIDENCE_COMPLETENESS=${missing.length === 0}`);
if (state !== 'PASS') process.exitCode = 1;
