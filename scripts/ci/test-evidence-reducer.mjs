#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const reducer = join(ROOT, 'scripts/ci/reduce-test-evidence.mjs');
const temp = mkdtempSync(join(tmpdir(), 'flixo-evidence-'));

const runCase = (name, input, expectedExit, expectedState) => {
  const inputPath = join(temp, `${name}.json`);
  const outputPath = join(temp, `${name}-out.json`);
  writeFileSync(inputPath, JSON.stringify(input));
  let exit = 0;
  try {
    execFileSync(process.execPath, [reducer, `--input=${inputPath}`, `--output=${outputPath}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    exit = error.status ?? 1;
  }
  if (exit !== expectedExit) throw new Error(`${name}: expected exit ${expectedExit}, got ${exit}`);
  if (expectedState !== null) {
    const evidence = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (evidence.state !== expectedState) throw new Error(`${name}: expected ${expectedState}, got ${evidence.state}`);
  }
};

const base = {
  schema: 'flixo-test-impact/v1',
  evidenceClass: 'PRIMARY_EXECUTION',
  sha: '0123456789abcdef0123456789abcdef01234567',
  base: 'fedcba9876543210fedcba9876543210fedcba98',
  impactMapSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  tier: 'contract',
  domains: [{ domain: 'admin', tier: 'contract', files: ['api/admin/boundary.ts'] }],
  commands: ['npm run typecheck', 'npm run test:admin-server-boundary'],
};

runCase('pass', { ...base, status: 'PASS', results: base.commands.map((command) => ({ command, status: 'PASS' })) }, 0, 'PASS');
runCase('fail', { ...base, status: 'FAIL', results: [{ command: base.commands[0], status: 'FAIL' }, { command: base.commands[1], status: 'PASS' }] }, 1, 'FAIL');
runCase('incomplete', { ...base, status: 'PASS', results: [{ command: base.commands[0], status: 'PASS' }] }, 1, 'BLOCKED');
runCase('blocked', { ...base, status: 'FAIL', results: base.commands.map((command) => ({ command, status: 'BLOCKED' })) }, 1, 'BLOCKED');
runCase('duplicate', { ...base, status: 'PASS', results: [{ command: base.commands[0], status: 'PASS' }, { command: base.commands[0], status: 'PASS' }, { command: base.commands[1], status: 'PASS' }] }, 1, null);

rmSync(temp, { recursive: true, force: true });
console.log('TEST_EVIDENCE_REDUCER=PASS');
