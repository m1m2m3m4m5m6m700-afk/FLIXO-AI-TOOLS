import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['push trigger', /push:\s*\n\s*branches:\s*\[main\]/],
  ['single static-build engine', /\n\s{2}static-build:\s*\n/],
  ['Browser FAST engine', /\n\s{2}browser-fast:\s*\n/],
  ['Browser DEEP engine', /\n\s{2}browser-deep:\s*\n/],
  ['single certification gate', /\n\s{2}certify:\s*\n/],
  ['PR cancellation', /cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/],
  ['exact SHA', /EXPECTED_SHA/],
  ['immutable artifact identity', /flixo-head-sha\.txt[\s\S]*flixo-package-lock\.sha256/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

if (!/browser:\s*\[chromium, firefox, webkit\]/.test(workflow)) {
  console.error('CI contract failed: browser engine must own Chromium, Firefox and WebKit.');
  process.exit(1);
}

const fast = workflow.match(/browser-fast:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const deep = workflow.match(/browser-deep:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const fastSpecs = fast.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? [];
if (fastSpecs.length !== 22) {
  console.error(`CI contract failed: FAST browser ownership must contain exactly 22 canonical tool specs; found ${fastSpecs.length}.`);
  process.exit(1);
}
if (!/tests\/localization-runtime\.spec\.ts/.test(deep)) {
  console.error('CI contract failed: DEEP browser ownership must retain localization runtime coverage.');
  process.exit(1);
}
if (!/github\.event_name\s*!=\s*'pull_request'/.test(deep)) {
  console.error('CI contract failed: DEEP browser execution must be main/release only.');
  process.exit(1);
}

try {
  execFileSync(process.execPath, ['scripts/ci/validate-playwright-surface.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/validate-certification-surface.mjs'], { stdio: 'inherit' });
} catch {
  console.error('CI contract failed: browser/certification surface validation failed.');
  process.exit(1);
}

console.log('CI contract passed: one static+build engine, one FAST browser engine, one DEEP browser engine, exact SHA/artifact provenance, and one fail-closed certification gate.');
