import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const testEngine = readFileSync('scripts/test.mjs', 'utf8');
const certifyEngine = readFileSync('scripts/ci/certify.mjs', 'utf8');
const certifyCore = readFileSync('scripts/ci/certify-core.mjs', 'utf8');
const resultState = readFileSync('scripts/ci/result-state.mjs', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['push trigger', /push:\s*\n\s*branches:\s*\[main\]/],
  ['single static-build engine', /\n\s{2}verify:\s*\n/],
  ['Browser FAST engine', /\n\s{2}browser_fast:\s*\n/],
  ['Browser DEEP engine', /\n\s{2}browser_deep:\s*\n/],
  ['single certification gate', /\n\s{2}certify:\s*\n/],
  ['PR cancellation', /cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/],
  ['exact SHA', /EXPECTED_SHA/],
  ['immutable artifact identity', /flixo-head-sha\.txt[\s\S]*flixo-package-lock\.sha256/],
  ['minimal checkout', /fetch-depth:\s*1/],
  ['primary evidence class', /evidenceClass["']?\s*:\s*["']PRIMARY_EXECUTION["']/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

for (const [label, source, pattern] of [
  ['central result-state reducer', testEngine, /result-state\.mjs/],
  ['central result-state reducer import in certification core', certifyCore, /result-state\.mjs/],
  ['certification wrapper delegates to canonical core', certifyEngine, /certify-core\.mjs/],
  ['explicit cancellation state', resultState, /['"]CANCELLED['"]/],
  ['explicit missing-evidence state', resultState, /['"]MISSING_EVIDENCE['"]/],
  ['explicit malformed-evidence state', resultState, /['"]MALFORMED_EVIDENCE['"]/],
  ['fail-closed state reduction', resultState, /counts\.CANCELLED === 0[\s\S]*counts\.NOT_EXECUTED === 0/],
]) {
  if (!pattern.test(source)) {
    console.error(`CI contract failed: ${label} is missing.`);
    process.exit(1);
  }
}

if (!/browser:\s*\[chromium, firefox, webkit\]/.test(workflow)) {
  console.error('CI contract failed: browser engine must own Chromium, Firefox and WebKit.');
  process.exit(1);
}

const fast = workflow.match(/browser_fast:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const deep = workflow.match(/browser_deep:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const fastSpecs = [...new Set(fast.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? [])];
if (fastSpecs.length !== 22) {
  console.error(`CI contract failed: FAST browser ownership must contain exactly 22 unique canonical tool specs; found ${fastSpecs.length}.`);
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
  execFileSync(process.execPath, ['scripts/ci/validate-agent-protocol.mjs'], { stdio: 'inherit' });
} catch {
  console.error('CI contract failed: browser/certification/agent-protocol surface validation failed.');
  process.exit(1);
}

console.log('CI contract passed: one execution graph, centralized result-state reduction, explicit evidence provenance, minimal SHA checkout, one FAST engine, one DEEP engine, one fail-closed certification gate, and mandatory multi-agent protocol.');
