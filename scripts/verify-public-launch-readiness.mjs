import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const required = [
  'docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md',
  'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md',
  'docs/FLIXO-LAUNCH-DAY-RUNBOOK.md',
  'docs/FLIXO-ANALYTICS-CONTRACT.md',
  'docs/FLIXO-TRUST-AND-OPERATIONS.md',
  'docs/FLIXO-LAUNCH-DISTRIBUTION-PACK.md',
  'docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md',
  'docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
];

const missing = required.filter((path) => !existsSync(resolve(path)));
if (missing.length) {
  console.error('[launch-readiness] BLOCKED: missing required files');
  for (const path of missing) console.error(` - ${path}`);
  process.exit(1);
}

const manifest = readFileSync(resolve('docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md'), 'utf8');
const certificate = readFileSync(resolve('docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md'), 'utf8');
const blockers = readFileSync(resolve('docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md'), 'utf8');

if (!/Candidate SHA: `REQUIRED`/.test(manifest)) {
  console.error('[launch-readiness] BLOCKED: release manifest is not in candidate-template state.');
  process.exit(1);
}
if (!/Status: NOT CERTIFIED/.test(certificate)) {
  console.error('[launch-readiness] BLOCKED: certificate template state is invalid.');
  process.exit(1);
}
if (!/No repository code license has been selected/.test(blockers)) {
  console.error('[launch-readiness] BLOCKED: legal blocker ledger changed unexpectedly.');
  process.exit(1);
}

console.log('[launch-readiness] PASS: launch program structure is present and fail-closed placeholders remain explicit.');
console.log('[launch-readiness] NOTE: external account/legal actions and exact-SHA evidence are still required for certification.');
