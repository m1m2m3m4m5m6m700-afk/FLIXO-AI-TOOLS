import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Canonical Verification job', /canonical-verify:/],
  ['canonical aggregator name', /name:\s*Canonical Verification Gate/],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/],
  ['lint prerequisite', /needs:\s*\[typecheck, lint,/],
  ['build prerequisite', /needs:\s*\[typecheck, lint, build,/],
  ['audit prerequisite', /needs:\s*\[typecheck, lint, build, audit,/],
  ['socket prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket,/],
  ['secret-scan prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket, secret-scan,/],
  ['security prerequisite', /secret-scan[\s\S]*?security/],
  ['fast-contract prerequisite', /fast-contract/],
  ['s3 prerequisite', /s3-static-gate/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm\s+run\s+verify|npm\s+test(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must be aggregator-only and must not rerun the verification suite.');
  process.exit(1);
}

if (!/github\.sha/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must attest the exact GitHub SHA.');
  process.exit(1);
}

if (!/!=\s*'skipped'/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must reject skipped prerequisites.');
  process.exit(1);
}

console.log('CI contract passed: canonical aggregator, explicit prerequisites, exact-SHA evidence, and skip rejection are enforced.');
