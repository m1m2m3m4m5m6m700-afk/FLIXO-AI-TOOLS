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
]);
for (const item of text) {
  if (deprecated.has(item.file) && /(^|\n)\s*(pull_request|push):/.test(item.text)) {
    failures.push(`${item.file}: legacy/diagnostic workflow must be manual-only.`);
  }
}

const ci = find('ci.yml');
for (const marker of ['canonical-verify:', 'fast-contract:', 'build:', 'evidence-ledger:', 's4-runtime-e2e:']) {
  if (!ci.includes(marker)) failures.push(`ci.yml missing canonical owner: ${marker}`);
}
if (!/FAIL-CLOSED/i.test(ci)) failures.push('ci.yml must declare FAIL-CLOSED architecture.');
if (/Skip Socket CI when no token is configured/.test(ci)) failures.push('Socket gate may not silently skip.');
if (/browser-smoke/i.test(ci)) failures.push('Canonical CI must not own browser-smoke verification.');
if (/s3-static-gate:[\s\S]{0,1600}npm run build(?!:runtime)/.test(ci)) failures.push('S3 Static Gate must consume artifact, never rebuild.');
if (!/flixo-build-\$\{\{ github\.sha \}\}/.test(ci)) failures.push('CI must publish a SHA-addressed immutable build artifact.');
if (!/s4-runtime-e2e:[\s\S]{0,1400}needs:\s*\[build\]/.test(ci)) failures.push('S4 must depend on the canonical Build Once job.');
if (!/s4-runtime-e2e:[\s\S]{0,14000}download-artifact@v7/.test(ci)) failures.push('S4 must consume the immutable CI build artifact.');
if (!/s4-runtime-e2e:[\s\S]{0,20000}S4 RUNTIME ROOT CAUSE DETECTED/.test(ci)) failures.push('S4 must fail-fast on first runtime root cause.');

const standaloneS4 = find('s4-runtime-e2e.yml');
if (standaloneS4) {
  if (/(^|\n)\s*(pull_request|push):/.test(standaloneS4)) failures.push('Standalone S4 diagnostic must be manual-only.');
  if (/name:\s*S4 Runtime \+ E2E/.test(standaloneS4)) failures.push('Standalone S4 diagnostic may not reuse the blocking owner name.');
  if (!/workflow_dispatch:/.test(standaloneS4)) failures.push('Standalone S4 diagnostic must support manual execution.');
}

const fullMatrix = find('full-matrix-parallel.yml') || find('full-matrix-promotion.yml');
const fullMatrixParallel = find('full-matrix-parallel.yml');
const legacyFullMatrix = find('full-matrix-promotion.yml');
if (legacyFullMatrix && /(^|\n)\s*(pull_request|push):/.test(legacyFullMatrix)) {
  failures.push('Legacy Full Matrix Promotion workflow must not define its own PR/push surface.');
}
if (!fullMatrixParallel) {
  if (!/workflow_run:[\s\S]*workflows:\s*\[CI\]/.test(fullMatrix)) failures.push('Full Matrix must either run in the parallel DAG or consume the canonical CI workflow artifact on main.');
} else {
  if (!/pull_request:[\s\S]*branches:\s*\[main\]/.test(fullMatrixParallel)) failures.push('Full Matrix Parallel must run on the canonical pull request trigger.');
  if (!/source_build:[\s\S]*npm run build/.test(fullMatrixParallel)) failures.push('Full Matrix Parallel must establish its own immutable source build.');
  if (!/write-build-artifact-manifest\.mjs/.test(fullMatrixParallel)) failures.push('Full Matrix Parallel must publish an immutable build manifest.');
  if (!/full-matrix-source-\$\{\{ github\.sha \}\}/.test(fullMatrixParallel)) failures.push('Full Matrix Parallel source artifact must be SHA-addressed.');
  if (!/needs:\s*\[source_build, weighted_plan\]/.test(fullMatrixParallel)) failures.push('Full Matrix E2E must depend on both canonical source build and weighted plan.');
  if (!/fromJSON\(needs\.weighted_plan\.outputs\.matrix\)/.test(fullMatrixParallel)) failures.push('Full Matrix E2E must consume the weighted plan output without ambiguous expression property access.');
}
if (!/weighted-shard-plan\.mjs/.test(fullMatrix)) failures.push('Full Matrix must use the weighted shard planner.');
if (!/download-artifact@v7/.test(fullMatrix)) failures.push('Full Matrix must consume an immutable artifact.');
if (!/23/.test(fullMatrix) || !/webkit/.test(fullMatrix) || !/chromium/.test(fullMatrix) || !/firefox/.test(fullMatrix)) {
  failures.push('Full Matrix must retain the complete 23-suite × 3-browser surface.');
}

const localization = find('localization-20.yml');
if (/['"]fix\/\*\*|['"]feat\/\*\*|['"]ci\/\*\*|['"]refactor\/\*\*|['"]seo\/\*\*/.test(localization)) {
  failures.push('Localization must not replay automatically on feature/fix/ci/seo/refactor branch pushes.');
}

// Canonical locale set is owned by src/lib/i18n/config.ts. The workflow must match it
// exactly; a legacy hard-coded locale list is drift and must fail closed.
const localeConfig = readFileSync('src/lib/i18n/config.ts', 'utf8').match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1] ?? '';
const canonicalLocales = localeConfig.match(/['"][A-Za-z-]+['"]/gu)?.map((value) => value.slice(1, -1)) ?? [];
const workflowLocales = localization.match(/G4_LOCALES:\s*['"]([^'"]+)['"]/u)?.[1]?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
if (canonicalLocales.length !== 20) failures.push(`Canonical locale registry count=${canonicalLocales.length}; expected 20.`);
if (canonicalLocales.length !== workflowLocales.length || canonicalLocales.some((locale, index) => locale !== workflowLocales[index])) {
  failures.push(`Localization workflow locale drift: registry=${canonicalLocales.join(',')} workflow=${workflowLocales.join(',')}`);
}

const owners = [
  ['build', /name:\s*Runtime Build \+ Performance/],
  ['s4', /name:\s*S4 Runtime \+ E2E/],
  ['full-matrix', /name:\s*Full Matrix (?:Promotion|Parallel)/],
  ['localization', /name:\s*(?:Localization — 20 Locale Gate|G4 — Localization \+ SEO Matrix)/],
  ['canonical', /name:\s*Canonical Verification Gate/],
];
for (const [owner, pattern] of owners) {
  const count = text.filter((item) => pattern.test(item.text)).length;
  if (count !== 1) failures.push(`${owner} owner count=${count}; expected exactly 1.`);
}

console.log(
  failures.length
    ? failures.map((message) => `FAIL: ${message}`).join('\n')
    : `CI architecture contract PASS: ${workflows.length} workflow definitions inspected; canonical ownership is unique.`,
);
if (failures.length) process.exit(1);