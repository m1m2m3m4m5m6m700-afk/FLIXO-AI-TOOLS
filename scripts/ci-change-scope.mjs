#!/usr/bin/env node

/**
 * Fail-closed CI change classifier.
 *
 * This helper is intentionally conservative: an unknown file or dependency
 * boundary produces `full` rather than allowing a narrower test plan.
 * It is safe to consume from future workflow routing without ever converting
 * uncertainty into a skipped Required Gate.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const base = process.env.GITHUB_BASE_SHA || process.env.BASE_SHA;
const head = process.env.GITHUB_SHA || process.env.HEAD_SHA || 'HEAD';

if (!base) {
  console.error('CI change classification: missing base SHA; selecting full verification.');
  writeFileSync(process.env.GITHUB_OUTPUT || '/tmp/ci-change-scope.out', 'scope=full\nreason=missing-base-sha\n');
  process.exit(0);
}

const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${base}...${head}`], {
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean);

const scopes = new Set();
let unknown = false;

for (const file of files) {
  if (file === 'package.json' || file === 'package-lock.json' || file.startsWith('scripts/')) {
    scopes.add('contracts');
    unknown = true;
  } else if (file.startsWith('src/i18n/') || file.startsWith('src/locales/') || file.includes('locale')) {
    scopes.add('localization');
  } else if (file.startsWith('src/') || file.startsWith('tests/')) {
    scopes.add('runtime');
  } else if (file.startsWith('.github/workflows/')) {
    scopes.add('ci');
    unknown = true;
  } else if (file.startsWith('docs/') || file.endsWith('.md') || file.startsWith('.github/')) {
    scopes.add('docs');
  } else {
    scopes.add('full');
    unknown = true;
  }
}

if (unknown || scopes.has('full') || files.length === 0) {
  scopes.clear();
  scopes.add('full');
}

const scope = [...scopes].sort().join(',');
const reason = unknown ? 'unknown-or-high-impact-change' : 'deterministic-path-classification';
const output = `scope=${scope}\nreason=${reason}\nchanged_files=${files.length}\n`;

console.log(output.trim());
writeFileSync(process.env.GITHUB_OUTPUT || '/tmp/ci-change-scope.out', output);
