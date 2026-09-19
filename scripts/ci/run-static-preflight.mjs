#!/usr/bin/env node
import { spawn } from 'node:child_process';

const checks = [
  ['test-ownership', 'npm', ['run', 'validate:test-ownership']],
  ['agent-protocol', 'npm', ['run', 'validate:agent-protocol']],
  ['prompt-registry', 'npm', ['run', 'validate:prompt-registry']],
  ['prompt-intelligence', 'npm', ['run', 'test:prompt-intelligence']],
  ['agent-coordination', 'npm', ['run', 'validate:agent-coordination']],
  ['code-scout', 'npm', ['run', 'validate:code-scout']],
  ['technical-debt-contract', 'npm', ['run', 'validate:technical-debt-audit']],
  ['technical-debt-audit', 'node', ['scripts/ci/test-technical-debt-audit.mjs']],
  ['auto-repair-memory', 'npm', ['run', 'validate:auto-repair-memory']],
  ['auto-repair', 'npm', ['run', 'test:auto-repair']],
  ['build-identity', 'npm', ['run', 'test:build-identity']],
  ['agent-execution-control', 'npm', ['run', 'test:agent-execution-control']],
];

const run = ([name, command, args]) => new Promise((resolve) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const prefix = `[static-preflight:${name}]`;
  child.stdout.on('data', (data) => process.stdout.write(`${prefix} ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`${prefix} ${data}`));
  child.on('error', (error) => resolve({ name, code: 1, error }));
  child.on('close', (code, signal) => resolve({ name, code: code ?? 1, signal }));
});

const results = await Promise.all(checks.map(run));
const failures = results.filter((result) => result.code !== 0);

for (const result of results) {
  console.log(`STATIC_PREFLIGHT_${result.code === 0 ? 'PASS' : 'FAIL'}=${result.name}`);
}

if (failures.length) {
  console.error(`Static preflight failures: ${failures.map((result) => result.name).join(', ')}`);
  process.exitCode = 1;
}
