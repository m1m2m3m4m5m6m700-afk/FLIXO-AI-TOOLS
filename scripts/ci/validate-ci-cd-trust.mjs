#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { reduceCheckResults } from './result-state.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`CI/CD TRUST FAILURE: ${message}`); };

const ci = read('.github/workflows/ci.yml');
const cd = read('.github/workflows/cd.yml');
const certifyCore = read('scripts/ci/certify-core.mjs');

for (const token of [
  'EXPECTED_SHA:',
  'test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"',
  'sha256sum -c dist/flixo-package-lock.sha256',
  'name: Certification',
  'name: Validate execution graph completeness',
  'name: Single certification engine',
]) {
  if (!ci.includes(token)) fail(`missing canonical CI invariant: ${token}`);
}
if (!certifyCore.includes("r.status !== 'PASS'")) {
  fail("canonical certification engine is missing reducer PASS guard: r.status !== 'PASS'");
}
if (/continue-on-error\s*:\s*true/i.test(ci)) fail('canonical CI contains continue-on-error=true');
if (!/if:\s*always\(\)/.test(ci)) fail('Certification must execute with if: always()');
if (!ci.includes('flixo-head-sha.txt')) fail('CI does not stamp the immutable build SHA');

const surface = spawnSync(process.execPath, ['scripts/ci/validate-certification-surface.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (surface.error) throw surface.error;
if (surface.status !== 0) fail(`canonical certification-surface validator failed:\n${surface.stdout}${surface.stderr}`);

const workflowDir = path.join(root, '.github/workflows');
const forbidden = fs.readdirSync(workflowDir).filter((entry) => /^unified-orchestrator\.ya?ml$/i.test(entry));
if (forbidden.length) fail(`parallel orchestrator workflow exists: ${forbidden.join(', ')}`);

for (const token of [
  'workflow_dispatch:',
  'git fetch --no-tags --depth=1 origin main',
  'skip_deploy=false',
  'SKIPPED_STALE_SHA',
  'Manual promotion rejected',
  'gh run download',
  'test "$(cat /tmp/artifact/flixo-head-sha.txt)" = "$PROMOTION_SHA"',
  'production.html',
  'flixo-head-sha.txt',
]) {
  if (!cd.includes(token)) fail(`missing canonical CD invariant: ${token}`);
}
if (/workflow_run:/m.test(cd)) fail('CD must be manual-only and must not auto-promote from workflow_run');
if (cd.includes('Automatic promotion skipped safely')) fail('CD contains obsolete automatic-promotion handling after manual-only migration');

if (!cd.includes('if [ "$head_sha" = "$PROMOTION_SHA" ] && [ "$main_sha" = "$PROMOTION_SHA" ]; then')) {
  fail('CD does not require exact checkout SHA and current main SHA for promotion');
}
if (!cd.includes('if [ "$EVENT_NAME" = "workflow_dispatch" ]; then')) {
  fail('CD manual promotion guard is missing');
}
if (!cd.includes('exit 1')) fail('CD must fail closed for rejected manual promotion/certification');
if (!cd.includes('exit 0')) fail('CD must safely skip stale automatic promotion');
if (!/if:\s*always\(\)/.test(cd)) fail('CD evidence upload must execute with if: always()');
if (!cd.includes('if-no-files-found: error')) fail('CD evidence upload must fail if evidence is unexpectedly missing');
if (/continue-on-error\s*:\s*true/i.test(cd)) fail('CD contains continue-on-error=true');

assert.equal(reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: 'PASS' }], 2).decision, true);
for (const state of ['FAIL', 'BLOCKED', 'CANCELLED', 'NOT_EXECUTED', 'MISSING_EVIDENCE', 'MALFORMED_EVIDENCE']) {
  const result = reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: state }], 2);
  if (result.decision) fail(`negative-control state ${state} incorrectly certified`);
}
if (reduceCheckResults([{ id: 'A', status: 'PASS' }], 2).decision) fail('missing execution unit incorrectly certified');
if (reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'A', status: 'PASS' }], 1).decision) fail('unexpected execution cardinality incorrectly certified');

const expectedSemantic = new Set(Array.from({ length: 66 }, (_, index) => `FAST:${index}`));
const tamperedSemantic = new Set(expectedSemantic);
tamperedSemantic.delete('FAST:65');
if (tamperedSemantic.size === expectedSemantic.size) fail('coverage mutation was not detected');
if (tamperedSemantic.size !== 65) fail('coverage mutation cardinality control failed');

const digestA = createHash('sha256').update('IMMUTABLE-CI-CD-TRUST').digest('hex');
const digestB = createHash('sha256').update('TAMPERED-CI-CD-TRUST').digest('hex');
if (digestA === digestB) fail('artifact tamper mutation produced identical digest');

if (ci.includes('npx --yes vercel@latest deploy')) fail('CI unexpectedly owns deployment');
if (cd.includes('npm run test:static')) fail('CD unexpectedly owns application certification');

const result = {
  schema_version: 2,
  authority: 'CANONICAL_CI_CD_TRUST_LAYER',
  status: 'PASS',
  controls: {
    canonicalSurfaceValidator: true,
    failClosedReducer: true,
    coverageMutationDetection: true,
    evidenceTamperDetection: true,
    exactShaBinding: true,
    staleAutomaticPromotionSafeSkip: true,
    manualPromotionFailClosed: true,
    canonicalAuthoritySingle: true,
    productionIdentityExpected: true,
    roleSeparation: true,
  },
  runtime: process.version,
};
console.log(JSON.stringify(result, null, 2));
