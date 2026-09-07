import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = '.github/workflows';
const workflows = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/.test(file));
const text = workflows.map((file) => ({ file, text: readFileSync(`${workflowDir}/${file}`, 'utf8') }));
const failures = [];
const find = (file) => text.find((item) => item.file === file)?.text ?? '';

const deprecated = new Set([
  'browser-smoke.yml',
  'phase3-chain-compatibility.yml',
  'parallel-diagnostics.yml',
  'root-cause-diagnostics.yml',
  's4-runtime-e2e.yml',
]);
for (const item of text) {
  if (deprecated.has(item.file) && /(^|\n)\s*(pull_request|push):/.test(item.text)) {
    failures.push(`${item.file}: legacy/diagnostic workflow must be manual-only.`);
  }
}

const ci = find('ci.yml');
if (!ci) failures.push('ci.yml is missing.');
if (!/matrix-certification:[\s\S]*uses:\s*\.\/\.github\/workflows\/matrix-first\.yml/.test(ci)) {
  failures.push('ci.yml must call the canonical Matrix First reusable workflow.');
}
if (!/ci:[\s\S]*needs:\s*\[matrix-certification\]/.test(ci)) {
  failures.push('CI execution must be natively dependent on Matrix First certification.');
}
if (!/fast-contract:[\s\S]*needs:\s*\[matrix-certification, ci\]/.test(ci)) {
  failures.push('Fast Contract Diagnostics must depend on both Matrix First and CI.');
}
if (!/canonical-verify:[\s\S]*needs:\s*\[matrix-certification, ci, fast-contract\]/.test(ci)) {
  failures.push('Canonical Verification must aggregate Matrix First, CI, and Fast Contract results.');
}
if (!/EXPECTED_HEAD_SHA/.test(ci) || !/ci-fast-evidence-\$\{\{ env\.EXPECTED_HEAD_SHA \}\}/.test(ci)) {
  failures.push('CI evidence artifacts must be addressed by EXPECTED_HEAD_SHA.');
}

const matrix = find('matrix-first.yml');
if (!matrix) failures.push('matrix-first.yml is missing.');
if (!/workflow_call:/.test(matrix)) failures.push('Matrix First must expose workflow_call for native dependency binding.');
if (/(^|\n)\s*pull_request:/.test(matrix)) failures.push('Matrix First must not create a duplicate direct PR execution surface.');
if (!/EXPECTED_HEAD_SHA/.test(matrix)) failures.push('Matrix First must use EXPECTED_HEAD_SHA for source identity.');
if (!/matrix-first-build-\$\{\{ env\.EXPECTED_HEAD_SHA \}\}/.test(matrix)) failures.push('Matrix First build artifact must be addressed by EXPECTED_HEAD_SHA.');
if (!/test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_HEAD_SHA"/.test(matrix)) failures.push('Matrix shards must verify the exact checked-out HEAD.');
if (!/--retries=0/.test(matrix) || !/--max-failures=1/.test(matrix)) failures.push('Matrix First must enforce retries=0 and max-failures=1.');
if (!/browser: chromium/.test(matrix) || !/browser: firefox/.test(matrix) || !/browser: webkit/.test(matrix)) failures.push('Matrix First must retain Chromium, Firefox, and WebKit coverage.');
if (!/fail-fast:\s*false/.test(matrix)) failures.push('Matrix First must preserve independent browser/shard failure visibility.');

const localization = find('localization-20.yml');
if (!/--retries=0\s+--max-failures=1/.test(localization)) failures.push('Localization 20-locale runtime gate must be fail-first.');

const g3 = find('g3-artifact-integrity.yml');
if (!/--retries=0\s+--max-failures=1/.test(g3)) failures.push('G3 browser artifact gate must be fail-first.');

if (find('full-matrix-parallel.yml')) failures.push('Deprecated Full Matrix Parallel workflow remains; Matrix First is the sole canonical browser matrix owner.');
if (find('full-matrix-promotion.yml')) failures.push('Deprecated Full Matrix Promotion workflow remains; Matrix First is the sole canonical browser matrix owner.');

const localeConfig = readFileSync('src/lib/i18n/config.ts', 'utf8').match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1] ?? '';
const canonicalLocales = localeConfig.match(/['"][A-Za-z-]+['"]/gu)?.map((value) => value.slice(1, -1)) ?? [];
const workflowLocales = localization.match(/G4_LOCALES:\s*['"]([^'"]+)['"]/u)?.[1]?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
if (canonicalLocales.length !== 20) failures.push(`Canonical locale registry count=${canonicalLocales.length}; expected 20.`);
if (canonicalLocales.length !== workflowLocales.length || canonicalLocales.some((locale, index) => locale !== workflowLocales[index])) {
  failures.push(`Localization workflow locale drift: registry=${canonicalLocales.join(',')} workflow=${workflowLocales.join(',')}`);
}

const owners = [
  ['matrix-first', /name:\s*Matrix First Gate/],
  ['canonical', /name:\s*Canonical Verification Gate/],
  ['localization', /name:\s*G4 — Localization \+ SEO Matrix/],
];
for (const [owner, pattern] of owners) {
  const count = text.filter((item) => pattern.test(item.text)).length;
  if (count !== 1) failures.push(`${owner} owner count=${count}; expected exactly 1.`);
}

console.log(
  failures.length
    ? failures.map((message) => `FAIL: ${message}`).join('\n')
    : `CI architecture contract PASS: ${workflows.length} workflow definitions inspected; canonical browser ownership is unique.`,
);
if (failures.length) process.exit(1);
