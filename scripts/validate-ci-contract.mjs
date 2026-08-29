import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Canonical Verification job', /canonical-verify:/],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/],
  ['lint prerequisite', /needs:\s*\[typecheck, lint,/],
  ['build prerequisite', /needs:\s*\[typecheck, lint, build,/],
  ['audit prerequisite', /needs:\s*\[typecheck, lint, build, audit,/],
  ['socket prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket,/],
  ['secret-scan prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket, secret-scan,/],
  ['security prerequisite', /security:/],
  ['fast-contract job', /fast-contract:/],
  ['S3 static gate', /s3-static-gate:/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm test(?![\w-])/.test(canonicalSection) || /npm run verify(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must remain an aggregator-only job.');
  process.exit(1);
}
if (/browser-smoke/.test(workflow)) {
  console.error('CI contract failed: Browser Smoke must not be a duplicate required surface.');
  process.exit(1);
}

console.log('CI contract passed: canonical aggregation, unique core ownership, and duplicate-surface prohibition are enforced.');
