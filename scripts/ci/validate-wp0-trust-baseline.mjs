#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
};

const taskState = read('src/lib/agent/task-state.ts');
const ci = read('.github/workflows/ci.yml');
const certification = read('scripts/ci/certification-engine.mjs');
const trust = read('scripts/ci/validate-ci-cd-trust.mjs');
const baseline = read('scripts/validate-engineering-baseline.mjs');
const packageJson = JSON.parse(read('package.json'));

for (const token of [
  'export type TaskState',
  'export type ConfirmationDecision',
  'export function transitionTask',
  'export function confirmTask',
  'export function cancelTask',
  'export function assertExecutionAllowed',
  "AWAITING_CONFIRMATION: ['EXECUTING', 'CANCELLED']",
  "EXECUTING: ['VERIFYING', 'FAILED', 'CANCELLED']",
]) requireToken(taskState, token, 'TaskState contract');

for (const token of [
  'EXPECTED_SHA:',
  'test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"',
  'dist/flixo-head-sha.txt',
  'dist/__flixo/build-identity.json',
  'name: Certification',
  'name: Validate execution graph completeness',
  'name: Single certification engine',
  'if: always()',
]) requireToken(ci, token, 'canonical CI contract');

for (const token of [
  'graph.exactSha !== expectedSha',
  'graph.runId',
  'status: errors.length === 0 ? \'PASS\' : \'FAIL\'',
  'exactSha: expectedSha',
]) requireToken(certification, token, 'certification exact-SHA contract');

for (const token of [
  'exactShaBinding: true',
  'canonicalAuthoritySingle: true',
  'productionIdentityExpected: true',
]) requireToken(trust, token, 'CI/CD trust contract');

for (const token of [
  'registryIsSourceOfTruth',
  'noNonReadyStaticRoutes',
  'noDuplicateVerificationTruth',
  'non-ready tool',
]) requireToken(baseline, token, 'readiness alignment contract');

if (packageJson.scripts?.verify !== 'npm run check && npm run audit:production') {
  failures.push('canonical npm verify contract changed unexpectedly');
}
if (packageJson.scripts?.['validate:baseline'] !== 'node scripts/validate-engineering-baseline.mjs') {
  failures.push('validate:baseline script is missing or changed');
}

if (failures.length) {
  console.error('WP0 TRUST BASELINE: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  schema_version: 1,
  authority: 'WP0_TRUST_BASELINE_STATIC_GATE',
  status: 'PASS',
  controls: {
    taskState: true,
    explicitConfirmationCancellation: true,
    canonicalVerification: true,
    exactShaEvidence: true,
    readinessAlignment: true,
    ciCdTrustBoundary: true,
  },
}, null, 2));
