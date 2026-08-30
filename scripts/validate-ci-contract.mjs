import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Canonical Verification job', /canonical-verify:/],
  ['Evidence Ledger job', /evidence-ledger:/],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/],
  ['lint prerequisite', /needs:\s*\[typecheck, lint,/],
  ['build prerequisite', /needs:\s*\[typecheck, lint, build,/],
  ['audit prerequisite', /needs:\s*\[typecheck, lint, build, audit,/],
  ['socket prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket,/],
  ['secret-scan prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket, secret-scan,/],
  ['security prerequisite', /secret-scan[\s\S]*?security/],
  ['fast-contract prerequisite', /fast-contract/],
  ['S3 prerequisite', /s3-static-gate/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm\s+run\s+verify(?![:\w-])/.test(canonicalSection) || /npm\s+test(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must aggregate evidence and must not rerun the repository verification suite.');
  process.exit(1);
}

if (!/flixo-build-\$\{\{ github\.sha \}\}/.test(workflow)) {
  console.error('CI contract failed: build artifact is not SHA-addressed.');
  process.exit(1);
}

if (!/flixo-evidence-ledger-\$\{\{ github\.sha \}\}/.test(workflow)) {
  console.error('CI contract failed: evidence ledger is not SHA-addressed.');
  process.exit(1);
}

if (/name:\s*Browser Smoke[\s\S]*?runs-on:/.test(workflow)) {
  console.error('CI contract failed: blocking CI must not define a duplicate Browser Smoke surface.');
  process.exit(1);
}

console.log('CI contract passed: canonical aggregation, evidence ledger, SHA-addressed artifacts, and no duplicate blocking browser surface are enforced.');
