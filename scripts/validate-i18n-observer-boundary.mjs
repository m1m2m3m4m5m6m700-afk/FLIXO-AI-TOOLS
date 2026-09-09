import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const files = [
  'src/lib/i18n/tool-ui-runtime.ts',
  'src/lib/i18n/tool-ui-runtime-supplement.ts',
  'src/lib/i18n/tool-ui-runtime-completeness.ts',
  'src/lib/i18n/tool-ui-technical-values.ts',
];

const globalObserverPattern = /(?:observer|bodyObserver)\.observe\(\s*document\.body\b/u;
const forbiddenDocumentBodyRootPattern = /(?:querySelector|querySelectorAll|createTreeWalker)\(\s*document\.body\b/u;

const violations = [];

for (const relativePath of files) {
  const filePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  if (globalObserverPattern.test(source)) {
    violations.push(`${relativePath}: global MutationObserver observes document.body`);
  }
  if (forbiddenDocumentBodyRootPattern.test(source)) {
    violations.push(`${relativePath}: DOM traversal is rooted directly at document.body`);
  }
}

if (violations.length > 0) {
  console.error('FAIL: i18n observer boundary contract violated.');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('Required boundary: scoped tool surface root; no document.body observer/traversal.');
  process.exit(1);
}

console.log('PASS: i18n observer boundary contract.');
