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

const fullMatrix = find('full-matrix-promotion.yml');
if (/^\s*pull_request:/m.test(fullMatrix)) failures.push('Full Matrix must not run independently on pull requests; S4 owns PR runtime coverage.');
if (!/workflow_run:[\s\S]*workflows:\s*\[CI\]/.test(fullMatrix)) failures.push('Full Matrix must consume the canonical CI workflow artifact on main.');
if (!/weighted-shard-plan\.mjs/.test(fullMatrix)) failures.push('Full Matrix must use the weighted shard planner.');
if (!/download-artifact@v7/.test(fullMatrix)) failures.push('Full Matrix must consume an immutable upstream artifact.');
if (!/23/.test(fullMatrix) || !/webkit/.test(fullMatrix) || !/chromium/.test(fullMatrix) || !/firefox/.test(fullMatrix)) {
  failures.push('Full Matrix must retain the complete 23-suite × 3-browser surface.');
}

const localization = find('localization-20.yml');
if (/['"]fix\/\*\*|['"]feat\/\*\*|['"]ci\/\*\*|['"]refactor\/\*\*|['"]seo\/\*\*/.test(localization)) {
  failures.push('Localization must not replay automatically on feature/fix/ci/seo/refactor branch pushes.');
}
if (!/matrix:[\s\S]{0,400}en, ar, es, fr, de, ru, zh, hi, id, ur, ja, pt, it, ko, nl, pl, tr, vi, th, sv/.test(localization)) {
  failures.push('Localization gate must retain all 20 locales.');
}

const owners = [
  ['build', /name:\s*Runtime Build \+ Performance/],
  ['s4', /name:\s*S4 Runtime \+ E2E/],
  ['full-matrix', /name:\s*Full Matrix Promotion/],
  ['localization', /name:\s*Localization — 20 Locale Gate/],
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
