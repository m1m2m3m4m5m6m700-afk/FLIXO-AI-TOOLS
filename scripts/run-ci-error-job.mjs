#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const id = process.argv[2];
const outDir = path.join('ci-error-results', id);
fs.mkdirSync(outDir, { recursive: true });
const logPath = path.join(outDir, 'run.log');
const resultPath = path.join(outDir, 'result.json');

const definitions = {
  'CI-001': { name: 'TypeScript Type Checking', category: 'static-analysis', priority: 'P0', commands: [['typecheck', 'npm run typecheck']] },
  'CI-002': { name: 'ESLint Code Quality', category: 'static-analysis', priority: 'P0', commands: [['lint', 'npm run lint -- --format json --output-file ci-eslint-report.json']] },
  'CI-003': { name: 'Registry & Contracts', category: 'contract-validation', priority: 'P0', commands: [['router-registry', 'npm run validate:router-registry'], ['contracts', 'npm run validate:contracts']] },
  'CI-004': { name: 'Unit Tests', category: 'testing', priority: 'P1', commands: [['unit', 'npm run test:unit']] },
  'CI-005': { name: 'Integration Tests', category: 'testing', priority: 'P1', kind: 'browser', project: 'chromium', suite: 'tests/integration/' },
  'CI-006': { name: 'E2E Tests (Chromium)', category: 'testing', priority: 'P1', kind: 'browser', project: 'chromium', suite: 'tests' },
  'CI-007': { name: 'E2E Tests (Firefox)', category: 'testing', priority: 'P1', kind: 'browser', project: 'firefox', suite: 'tests' },
  'CI-008': { name: 'E2E Tests (WebKit)', category: 'testing', priority: 'P1', kind: 'browser', project: 'webkit', suite: 'tests' },
  'CI-009': { name: 'Build & Artifact', category: 'build', priority: 'P0', commands: [['build', 'npm run build']] },
  'CI-010': { name: 'Security Audit', category: 'security', priority: 'P0', commands: [['audit', 'npm run audit:production'], ['file-safety', 'node --experimental-strip-types scripts/test-file-safety.mjs'], ['upload-boundary', 'npm run test:upload-boundary']] },
  'CI-011': { name: 'Bundle Analysis', category: 'performance', priority: 'P2', commands: [['build', 'npm run build'], ['bundle-size', 'npm run report:bundle-size'], ['performance-budget', 'npm run validate:performance-budget']] },
  'CI-012': { name: 'Localization Validation', category: 'i18n', priority: 'P1', commands: [['i18n', 'npm run validate:i18n'], ['language-quality', 'npm run validate:language-quality'], ['locale-integrity', 'npm run validate:locale-integrity']] },
  'CI-013': { name: '20-Language UI Validation', category: 'i18n', priority: 'P1', commands: [['i18n-strict', 'npm run verify:i18n']] },
  'CI-014': { name: '20-Language SEO Validation', category: 'i18n', priority: 'P1', commands: [['seo', 'npm run validate:seo'], ['seo-manifest', 'npm run validate:seo-manifest'], ['use-case-seo', 'npm run validate:use-case-seo'], ['indexing', 'npm run validate:indexing'], ['breadcrumb-seo', 'npm run validate:breadcrumb-seo']] },
  'CI-015': { name: '20-Language Routing Validation', category: 'i18n', priority: 'P1', commands: [['router-registry', 'npm run validate:router-registry'], ['route-resolver', 'npm run test:route-resolver'], ['locale-navigation', 'npm run validate:locale-navigation'], ['locale-integrity', 'npm run validate:locale-integrity']] },
  'CI-016': { name: 'Tool Input Validation', category: 'tool-contract', priority: 'P0', commands: [['upload-boundary', 'npm run test:upload-boundary'], ['tool-registry', 'npm run validate:tool-registry']] },
  'CI-017': { name: 'Tool Output Validation', category: 'tool-contract', priority: 'P0', commands: [['output-integrity', 'node --experimental-strip-types scripts/test-output-integrity.mjs'], ['svg-integrity', 'node --experimental-strip-types scripts/test-svg-integrity.mjs'], ['tool-localization', 'npm run test:tool-localization']] },
  'CI-018': { name: 'Tool Data Integrity', category: 'tool-contract', priority: 'P0', commands: [['tool-manifest', 'npm run validate:tool-manifest'], ['tool-registry', 'npm run validate:tool-registry'], ['baseline', 'npm run validate:baseline'], ['ci-contract', 'npm run validate:ci-contract']] },
};

const def = definitions[id];
if (!def) {
  fs.writeFileSync(resultPath, JSON.stringify({ testId: id, status: 'failure', message: `Unknown CI job: ${id}` }, null, 2));
  process.exit(1);
}

const startedAt = new Date().toISOString();
let overall = 0;
let server = null;
const chunks = [];

function record(text) {
  const line = String(text);
  chunks.push(line);
  fs.appendFileSync(logPath, line.endsWith('\n') ? line : `${line}\n`);
  process.stdout.write(line.endsWith('\n') ? line : `${line}\n`);
}

function runCommand(label, command) {
  record(`\n=== ${id} / ${label} ===\n$ ${command}\n`);
  const result = spawnSync('bash', ['-lc', command], { encoding: 'utf8' });
  if (result.stdout) record(result.stdout);
  if (result.stderr) record(result.stderr);
  const status = typeof result.status === 'number' ? result.status : 1;
  if (status !== 0) {
    overall = 1;
    record(`[FAIL] ${label}: exit ${status}\n`);
  } else {
    record(`[PASS] ${label}\n`);
  }
  return status;
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function runBrowser() {
  const isIntegration = id === 'CI-005';
  runCommand('build-runtime', 'npm run build:runtime');
  if (overall !== 0) return;

  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PLAYWRIGHT_TEST_BASE_URL: 'http://127.0.0.1:3000', S4_EXTERNAL_SERVER: 'true' },
  });
  server.stdout.on('data', (d) => record(`[server] ${d.toString()}`));
  server.stderr.on('data', (d) => record(`[server] ${d.toString()}`));

  const ready = await waitForServer('http://127.0.0.1:3000/');
  if (!ready) {
    overall = 1;
    record('[FAIL] preview server did not become ready.\n');
    return;
  }

  const suite = isIntegration ? 'tests/integration/' : 'tests';
  runCommand('playwright', `npx playwright test ${suite} --project=${def.project} --workers=4 --retries=0`);
}

try {
  fs.writeFileSync(logPath, '');
  if (def.kind === 'browser') await runBrowser();
  else for (const [label, command] of def.commands) runCommand(label, command);
} catch (error) {
  overall = 1;
  record(`[FATAL] ${error?.stack || error}\n`);
} finally {
  if (server) {
    server.kill('SIGTERM');
    setTimeout(() => server.kill('SIGKILL'), 2000).unref();
  }
}

const result = {
  schemaVersion: 1,
  testId: id,
  testName: def.name,
  category: def.category,
  priority: def.priority,
  status: overall === 0 ? 'success' : 'failure',
  startedAt,
  finishedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
  output: chunks.join(''),
};

fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Evidence written: ${resultPath}`);

// The aggregator owns the terminal decision so every job can finish and publish evidence.
process.exitCode = 0;
