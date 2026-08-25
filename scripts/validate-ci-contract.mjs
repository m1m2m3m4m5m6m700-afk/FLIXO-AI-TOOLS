import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Canonical Verification job', /canonical-verify:/],
  ['canonical npm run verify', /name:\s*Canonical Verification Gate[\s\S]*?run:\s*npm run verify/],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/],
  ['lint prerequisite', /needs:\s*\[typecheck, lint,/],
  ['build prerequisite', /needs:\s*\[typecheck, lint, build,/],
  ['audit prerequisite', /needs:\s*\[typecheck, lint, build, audit,/],
  ['socket prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket,/],
  ['secret-scan prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket, secret-scan,/],
  ['security prerequisite', /secret-scan[\s\S]*?security/],
  ['fast-contract prerequisite', /fast-contract/],
  ['browser-smoke prerequisite', /browser-smoke/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm test(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must not use npm test; use npm run verify.');
  process.exit(1);
}

console.log('CI contract passed: pull_request trigger, canonical npm run verify, and required diagnostic prerequisites are enforced.');
