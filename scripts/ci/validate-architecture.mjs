import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = '.github/workflows';
const workflows = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/.test(file));
const text = workflows.map((file) => ({ file, text: readFileSync(`${workflowDir}/${file}`, 'utf8') }));
const failures = [];
const find = (file) => text.find((item) => item.file === file)?.text ?? '';
const allWorkflows = text.map((item) => item.text).join('\n');

const deprecated = new Set([
  'browser-smoke.yml',
  'phase3-chain-compatibility.yml',
  'parallel-diagnostics.yml',
  'root-cause-diagnostics.yml',
  'flixo-ci-g3-shadow.yml',
]);
for (const item of text) {
  if (deprecated.has(item.file) && /(^|\n)\s*(pull_request|push):/.test(item.text)) {
    failures.push(`${item.file}: legacy/diagnostic workflow must be manual-only.`);
  }
}

const ci = find('ci.yml');
for (const marker of [
  'matrix-first:',
  'fast-contract:',
  'canonical-verify:',
  'g3-aggregator:',
  'final-contract-gate:',
]) {
  if (!ci.includes(marker)) failures.push(`ci.yml missing canonical owner: ${marker}`);
}
if (!/FAIL-CLOSED/i.test(ci) && !/FAIL-CLOSED/i.test(allWorkflows)) {
  failures.push('CI architecture must declare FAIL-CLOSED behavior.');
}
if (/check-runs\/\?per_page=[\s\S]{0,250}Matrix First Certification/.test(ci)) {
  failures.push('Canonical CI must not poll Matrix First Certification through GitHub check-run SHA.');
}
if (/Skip Socket CI when no token is configured/.test(ci)) failures.push('Socket gate may not silently skip.');
if (/browser-smoke/i.test(ci)) failures.push('Canonical CI must not own browser-smoke verification.');

const fullMatrix = find('full-matrix-parallel.yml');
const legacyFullMatrix = find('full-matrix-promotion.yml');
if (legacyFullMatrix && /(^|\n)\s*(pull_request|push):/.test(legacyFullMatrix)) {
  failures.push('Legacy Matrix Promotion workflow must not define its own PR/push surface.');
}
if (!fullMatrix) {
  failures.push('Canonical Matrix First workflow is missing: full-matrix-parallel.yml.');
} else {
  if (!/^name:\s*Matrix First\s*$/m.test(fullMatrix)) failures.push('Canonical matrix workflow must be named Matrix First.');
  if (!/workflow_call:[\s\S]*inputs:[\s\S]*source_sha:[\s\S]*required:\s*true/.test(fullMatrix)) failures.push('Matrix First must be callable with an explicit exact source_sha.');
  if (!/source_sha:[\s\S]*type:\s*string/.test(fullMatrix)) failures.push('Matrix First source_sha input must be typed as string.');
  if (!/secrets:[\s\S]*FLIXO_MATRIX_PLAN_SIGNING_KEY:[\s\S]*required:\s*true/.test(fullMatrix)) failures.push('Matrix First must require its signing secret.');
  if (/(^|\n)\s*pull_request:/.test(fullMatrix) || /(^|\n)\s*push:/.test(fullMatrix)) failures.push('Matrix First canonical execution must be invoked by CI, not define a competing PR/push trigger.');
  if (!/workflow_dispatch:/.test(fullMatrix)) failures.push('Matrix First must retain manual diagnostic invocation.');
  if (!/source_build:[\s\S]*npm run build/.test(fullMatrix)) failures.push('Matrix First must establish its own immutable source build.');
  if (!/write-build-artifact-manifest\.mjs/.test(fullMatrix)) failures.push('Matrix First must publish an immutable build manifest.');
  if (!/matrix-first-source-\$\{\{ inputs\.source_sha \|\| github\.sha \}\}/.test(fullMatrix)) failures.push('Matrix First source artifact must be bound to explicit source_sha.');
  if (!/needs:\s*\[source_build, weighted_plan\]/.test(fullMatrix)) failures.push('Matrix execution must depend on both source build and weighted plan.');
  if (!/fromJSON\(needs\.weighted_plan\.outputs\.matrix\)/.test(fullMatrix)) failures.push('Matrix execution must consume the weighted plan output.');
  if (!/name:\s*Matrix First Certification/.test(fullMatrix)) failures.push('Matrix First must expose exactly one canonical certification job.');
  if (!/_flixo_matrix_plan\.json/.test(fullMatrix)) failures.push('Matrix First must consume the signed _flixo_matrix_plan.json artifact.');
  if (/matrix-test-inventory\.json|write-matrix-test-inventory\.mjs/.test(allWorkflows)) failures.push('Repository CI workflows must not use a secondary matrix inventory artifact.');
  if (!/--fail-on-flaky-tests/.test(fullMatrix)) failures.push('Matrix First must fail closed on flaky Playwright tests.');
  if (!/MATRIX_PLAN_PATH=.*_flixo_matrix_plan\.json/.test(fullMatrix)) failures.push('Matrix evidence must be bound directly to _flixo_matrix_plan.json.');
}

const history = JSON.parse(readFileSync('ci/test-duration-history.json', 'utf8'));
const historyTests = Object.keys(history.tests);
if (historyTests.length !== 23) failures.push(`Canonical matrix suite registry count=${historyTests.length}; expected 23.`);
if (!/webkit/.test(fullMatrix) || !/chromium/.test(fullMatrix) || !/firefox/.test(fullMatrix)) failures.push('Matrix First must retain the complete three-browser surface.');
if (!/matrix-first-evidence-/.test(fullMatrix) || !/validate-full-matrix-evidence\.mjs/.test(fullMatrix)) failures.push('Matrix First must produce and validate exact-SHA evidence.');

const localization = find('localization-20.yml');
if (/['"]fix\/\*\*|['"]feat\/\*\*|['"]ci\/\*\*|['"]refactor\/\*\*|['"]seo\/\*\*/.test(localization)) failures.push('Localization must not replay automatically on feature/fix/ci/seo/refactor branch pushes.');

const localeConfig = readFileSync('src/lib/i18n/config.ts', 'utf8').match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1] ?? '';
const canonicalLocales = localeConfig.match(/['"][A-Za-z-]+['"]/gu)?.map((value) => value.slice(1, -1)) ?? [];
const workflowLocales = localization.match(/G4_LOCALES:\s*['"]([^'"]+)['"]/u)?.[1]?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
if (canonicalLocales.length !== 20) failures.push(`Canonical locale registry count=${canonicalLocales.length}; expected 20.`);
if (canonicalLocales.length !== workflowLocales.length || canonicalLocales.some((locale, index) => locale !== workflowLocales[index])) failures.push(`Localization workflow locale drift: registry=${canonicalLocales.join(',')} workflow=${workflowLocales.join(',')}`);

const owners = [
  ['matrix-first', (value) => /^name:\s*Matrix First\s*$/m.test(value)],
  ['localization', (value) => /^name:\s*G4 — Localization \+ SEO Matrix\s*$/m.test(value)],
  ['canonical', (value) => /^name:\s*Canonical Verification Gate\s*$/m.test(value)],
  ['agent-coordination', (value) => /^name:\s*Agent Coordination Guard\s*$/m.test(value)],
];
for (const [owner, predicate] of owners) {
  const count = text.filter((item) => predicate(item.text)).length;
  if (count !== 1) failures.push(`${owner} owner count=${count}; expected exactly 1.`);
}
const matrixCertificationCount = text.reduce((count, item) => count + (item.text.match(/name:\s*Matrix First Certification/g) || []).length, 0);
if (matrixCertificationCount !== 1) failures.push(`Matrix First Certification owner count=${matrixCertificationCount}; expected exactly 1.`);
const g3AggregatorCount = text.reduce((count, item) => count + (item.text.match(/name:\s*G3 \/ Aggregator/g) || []).length, 0);
if (g3AggregatorCount !== 1) failures.push(`G3 Aggregator owner count=${g3AggregatorCount}; expected exactly 1.`);

console.log(
  failures.length
    ? failures.map((message) => `FAIL: ${message}`).join('\n')
    : `CI architecture contract PASS: ${workflows.length} workflow definitions inspected; canonical ownership is unique.`,
);
if (failures.length) process.exit(1);
