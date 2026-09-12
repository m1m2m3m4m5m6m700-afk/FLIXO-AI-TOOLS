import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const executionFiles = [
  'src/main.tsx',
  'src/routes/localized-tool-page.tsx',
  'src/components/auto-localized-tool-surface.tsx',
];

const legacyInstallerPattern = /installToolUiRuntime(Localization|Supplement)|installToolUiTechnicalValueNormalization/u;
const bodyObserverPattern = /\.observe\(\s*document\.body\b/u;

const violations = [];

for (const relativePath of executionFiles) {
  const filePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  if (legacyInstallerPattern.test(source)) violations.push(`${relativePath}: legacy runtime i18n installer remains in the application execution path`);
  if (bodyObserverPattern.test(source)) violations.push(`${relativePath}: MutationObserver directly observes document.body`);
}

const page = fs.readFileSync(path.join(repoRoot, 'src/routes/localized-tool-page.tsx'), 'utf8');
if (!page.includes('data-flixo-i18n-root="tool-surface"')) {
  violations.push('localized-tool-page.tsx: declared scoped localization root is missing');
}

if (violations.length > 0) {
  console.error('FAIL: i18n execution-boundary contract violated.');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('PASS: i18n execution-boundary contract.');
