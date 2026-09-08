#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const errors = [];

const workflows = fs.readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => path.join(WORKFLOW_DIR, name));

for (const file of workflows) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');

  if (/VITE_(?:SITE|TEST|RUNTIME)_ORIGIN:\s*https?:\/\/canonical\.test/i.test(text)) {
    errors.push(`${relative}: canonical.test is forbidden in workflow certification/runtime environment`);
  }

  if (/PLAYWRIGHT_TEST_BASE_URL:\s*https?:\/\/canonical\.test/i.test(text)) {
    errors.push(`${relative}: canonical.test is forbidden as Playwright test origin`);
  }

  if (/https:\/\/canonical\.test/i.test(text) && !/canonical\.test.{0,120}(sentinel|fallback|diagnostic)/i.test(text)) {
    errors.push(`${relative}: contains an unclassified canonical.test reference`);
  }
}

const matrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'matrix-first.yml'), 'utf8');
const ci = fs.readFileSync(path.join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
const fullMatrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'full-matrix-parallel.yml'), 'utf8');

if (!/browser:\s*\[chromium, firefox, webkit\]/.test(matrix)) errors.push('Matrix First must own chromium/firefox/webkit');
if ((matrix.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length !== 22) errors.push('Matrix First must retain exactly 22 canonical tool specs');
if (!/Run impact selector/.test(ci) || !/scripts\/ci\/fast-verify\.mjs/.test(ci)) errors.push('CI must delegate impact execution to Fast Verify');
if (/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'fast-verify.mjs'), 'utf8'))) errors.push('Fast Verify must not execute Playwright directly');
if (!/browser:\s*\[chromium, firefox, webkit\]/.test(fullMatrix)) errors.push('Full Matrix must retain all three browsers');

const result = {
  schema_version: 1,
  status: errors.length ? 'FAIL' : 'PASS',
  workflowCount: workflows.length,
  checks: {
    forbiddenCertificationOrigin: errors.filter((e) => e.includes('canonical.test')).length === 0,
    matrixOwnership: /browser:\s*\[chromium, firefox, webkit\]/.test(matrix),
    matrixToolCount: (matrix.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length,
    fastVerifyNoBrowserExecution: !/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'fast-verify.mjs'), 'utf8')),
    fullMatrixOwnership: /browser:\s*\[chromium, firefox, webkit\]/.test(fullMatrix),
  },
  errors,
};

fs.mkdirSync(path.join(ROOT, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'certification', 'surface.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
