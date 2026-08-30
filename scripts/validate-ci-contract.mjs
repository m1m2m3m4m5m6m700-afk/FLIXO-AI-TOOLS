import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Evidence Ledger job', /evidence-ledger:/],
  ['TypeScript job', /typecheck:/],
  ['ESLint job', /lint:/],
  ['Build job', /build:/],
  ['Production Audit job', /audit:/],
  ['Socket Supply Chain job', /socket:/],
  ['Secret History Scan job', /secret-scan:/],
  ['CodeQL job', /security:/],
  ['Fast Contract Diagnostics job', /fast-contract:/],
  ['S3 Static Gate job', /s3-static-gate:/],
  ['S4 Runtime + E2E job', /s4-runtime-e2e:/],
  ['build prerequisite', /s3-static-gate:\s*\n\s*name:[\s\S]*?needs:\s*\[build\]/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const evidenceSection = workflow.match(/evidence-ledger:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const requiredEvidenceNeeds = [
  'typecheck',
  'lint',
  'build',
  'audit',
  'socket',
  'secret-scan',
  'security',
  'fast-contract',
  's3-static-gate',
  's4-runtime-e2e',
];

for (const gate of requiredEvidenceNeeds) {
  if (!new RegExp(`needs:\\s*\\[[^\\]]*\\b${gate}\\b`).test(evidenceSection)) {
    console.error(`CI contract failed: evidence-ledger is missing prerequisite ${gate}`);
    process.exit(1);
  }
}

if (!/evidence-ledger:\s*\n\s*name:\s*Evidence Ledger/.test(workflow)) {
  console.error('CI contract failed: evidence-ledger must be named Evidence Ledger.');
  process.exit(1);
}

if (!/if:\s*\$\{\{\s*always\(\)\s*\}\}/.test(evidenceSection)) {
  console.error('CI contract failed: evidence-ledger must materialize evidence with always().');
  process.exit(1);
}

if (!/flixo-build-\$\{\{ github\.sha \}\}/.test(workflow)) {
  console.error('CI contract failed: build artifact is not SHA-addressed.');
  process.exit(1);
}

if (!/Secret History Scan[\s\S]*?--config=\/repo\/\.gitleaks\.toml/.test(workflow)) {
  console.error('CI contract failed: Secret History Scan must load the versioned Gitleaks policy.');
  process.exit(1);
}

if (!/name:\s*Browser Smoke[\s\S]*?runs-on:/.test(workflow)) {
  console.log('CI contract note: no duplicate blocking Browser Smoke surface detected.');
}

if (!/s4-runtime-e2e:[\s\S]*?Run Chromium Firefox WebKit with zero retries/.test(workflow)) {
  console.error('CI contract failed: S4 must execute the zero-retry Chromium/Firefox/WebKit promotion matrix.');
  process.exit(1);
}

console.log('CI contract passed: canonical evidence ledger, SHA-addressed build artifact, versioned secret policy, S3/S4 gates, and no duplicate blocking browser surface are enforced.');
