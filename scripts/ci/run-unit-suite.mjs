#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();
const packageJson = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
const scripts = [
  'test:quickflow',
  'test:agent-capability',
  'test:agent-execution-gate',
  'test:agent-language',
  'test:ai-planner',
  'test:agent-self-correction',
  'test:llm-provider',
  'test:i18n',
  'test:route-resolver',
  'test:upload-boundary',
  'test:tool-localization',
  'test:image-core',
  'test:tool-platform',
  'validate:i18n-observer-boundary',
  'validate:tool-definition',
  'test:unified-audit',
  'test:checkpoint-producer',
  'test:execution-sha-provenance',
  'test:admin-server-boundary',
  'test:admin-persistence',
  'test:admin-persistence-contract',
  'test:admin-canonical-contract',
  'test:admin-integrity-readback',
  'test:admin-execution-policy',
  'test:admin-capability-contract',
  'test:negative-control-integration',
];

const missing = scripts.filter((name) => typeof packageJson.scripts?.[name] !== 'string');
if (missing.length) {
  console.error(`UNIT_SUITE_MISSING_SCRIPTS=${missing.join(',')}`);
  process.exit(2);
}

const requested = Number(process.env.FLIXO_UNIT_MAX_CONCURRENCY ?? 12);
const maxConcurrency = Number.isInteger(requested) && requested >= 1 && requested <= 16 ? requested : 12;

const run = (name) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('npm', ['run', name], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  child.on('error', (error) => resolve({ name, code: 1, durationMs: Date.now() - started, error: error.message }));
  child.on('close', (code, signal) => resolve({ name, code: code ?? 1, signal: signal ?? null, durationMs: Date.now() - started }));
});

let cursor = 0;
let failures = 0;
const results = [];
const worker = async () => {
  while (true) {
    const index = cursor++;
    if (index >= scripts.length) return;
    const result = await run(scripts[index]);
    results[index] = result;
    if (result.code !== 0) failures += 1;
  }
};

const workers = Array.from({ length: Math.min(maxConcurrency, scripts.length) }, () => worker());
await Promise.all(workers);

for (const result of results) {
  console.log(`UNIT_CHECK=${result.name} STATUS=${result.code === 0 ? 'PASS' : 'FAIL'} DURATION_MS=${result.durationMs}`);
  if (result.error) console.error(`UNIT_CHECK_ERROR=${result.name} ${result.error}`);
}
console.log(`UNIT_SUITE_TOTAL=${scripts.length}`);
console.log(`UNIT_SUITE_MAX_CONCURRENCY=${maxConcurrency}`);
console.log(`UNIT_SUITE_FAILURES=${failures}`);

if (failures) process.exitCode = 1;
