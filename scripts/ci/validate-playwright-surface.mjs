#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'tests');
const failures = [];
const specs = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.spec\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(entry.name)) specs.push(path);
  }
}

walk(ROOT);
specs.sort();

for (const file of specs) {
  const rel = relative(process.cwd(), file).replaceAll('\\', '/');
  if (rel.startsWith('tests/fixtures/')) continue;
  const source = readFileSync(file, 'utf8');
  const direct = /from\s+["']@playwright\/test["']/u.test(source) || /import\s*\(\s*["']@playwright\/test["']\s*\)/u.test(source);
  const fixture = /fixtures\/universal-runtime-evidence(?:\.ts)?["']/u.test(source);
  if (direct) failures.push(`${rel}: direct @playwright/test import is forbidden`);
  if (!fixture) failures.push(`${rel}: universal-runtime-evidence fixture is not imported`);
}

const plan = readFileSync(join(process.cwd(), 'scripts/ci/test-plan.json'), 'utf8');
if (!/tests\/universal-diagnostic-browser\.spec\.ts/u.test(plan)) {
  failures.push('scripts/ci/test-plan.json: browser diagnostic gate must own the dedicated universal diagnostic suite');
}
if (/playwright\s+test(?:\s+[^\n]*?)?--project=chromium/u.test(plan) && /playwright\s+test[^\n]*tests\/universal-diagnostic-browser\.spec\.ts/u.test(plan) === false) {
  failures.push('scripts/ci/test-plan.json: browser gate contains broad Playwright execution without the universal diagnostic suite');
}

if (failures.length) {
  console.error('Playwright surface contract FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Playwright surface contract PASS: ${specs.length} spec files use the universal runtime fixture.`);
