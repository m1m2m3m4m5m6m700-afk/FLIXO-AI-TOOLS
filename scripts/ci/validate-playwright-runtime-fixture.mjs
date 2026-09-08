import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'tests';
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(spec|test)\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) inspect(path);
  }
}

function inspect(path) {
  if (path.endsWith('tests/fixtures/runtime-evidence.ts')) return;
  const source = readFileSync(path, 'utf8');
  const directPlaywrightImport = /(?:import\s+[^;]*?from\s*['"]@playwright\/test['"]|import\s*\(\s*['"]@playwright\/test['"]\s*\))/s.test(source);
  const localFixtureImport = /from\s*['"][^'"]*fixtures\/runtime-evidence['"]/.test(source);
  if (directPlaywrightImport || !localFixtureImport) {
    failures.push({
      file: relative(process.cwd(), path),
      directPlaywrightImport,
      localFixtureImport,
    });
  }
}

walk(root);

if (failures.length) {
  console.error(JSON.stringify({ schema_version: 1, status: 'FAIL', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ schema_version: 1, status: 'PASS', message: 'Every Playwright test consumes the universal runtime evidence fixture.' }, null, 2));
