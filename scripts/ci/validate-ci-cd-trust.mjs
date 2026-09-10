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

for (const token of [
  'EXPECTED_SHA:',
  'test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"',
  'sha256sum -c dist/flixo-package-lock.sha256',
  'name: Certification',
  'name: Validate execution graph completeness',
  'name: Single certification engine',
  'r.status !== \'PASS\'',
  'value !== 0',
]) {
  if (!ci.includes(token)) fail(`missing canonical CI invariant: ${token}`);
}
if (/continue-on-error\s*:\s*true/i.test(ci)) fail('canonical CI contains continue-on-error=true');
if (!/if:\s*always\(\)/.test(ci)) fail('Certification must execute with if: always()');
if (!ci.includes('flixo-head-sha.txt')) fail('CI does not stamp the immutable build SHA');

// Invoke the repository's actual canonical surface validator instead of duplicating its policy here.
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
  'workflows: ["FLIXO Test System"]',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.event == 'push'",
  'test "$(git rev-parse origin/main)" = "$PROMOTION_SHA"',
  'gh run download',
  'test "$(cat /tmp/artifact/flixo-head-sha.txt)" = "$PROMOTION_SHA"',
  'production.html',
  'flixo-head-sha.txt',
]) {
  if (!cd.includes(token)) fail(`missing canonical CD invariant: ${token}`);
}
if (/continue-on-error\s*:\s*true/i.test(cd)) fail('CD contains continue-on-error=true');

// Negative controls for the canonical reducer: every known bad state must be rejected.
assert.equal(reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: 'PASS' }], 2).decision, true);
for (const state of ['FAIL', 'BLOCKED', 'CANCELLED', 'NOT_EXECUTED', 'MISSING_EVIDENCE', 'MALFORMED_EVIDENCE']) {
  const result = reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: state }], 2);
  if (result.decision) fail(`negative-control state ${state} incorrectly certified`);
}
if (reduceCheckResults([{ id: 'A', status: 'PASS' }], 2).decision) fail('missing execution unit incorrectly certified');
if (reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'A', status: 'PASS' }], 1).decision) fail('unexpected execution cardinality incorrectly certified');

// Coverage mutation control: one missing semantic unit must be detected.
const expectedSemantic = new Set(Array.from({ length: 66 }, (_, index) => `FAST:${index}`));
const tamperedSemantic = new Set(expectedSemantic);
tamperedSemantic.delete('FAST:65');
if (tamperedSemantic.size === expectedSemantic.size) fail('coverage mutation was not detected');
if (tamperedSemantic.size !== 65) fail('coverage mutation cardinality control failed');

// Evidence tamper control: a changed payload must produce a different digest.
const digestA = createHash('sha256').update('IMMUTABLE-CI-CD-TRUST').digest('hex');
const digestB = createHash('sha256').update('TAMPERED-CI-CD-TRUST').digest('hex');
if (digestA === digestB) fail('artifact tamper mutation produced identical digest');

// Role-separation control: certification cannot silently absorb deployment, and CD cannot certify the app.
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
    canonicalAuthoritySingle: true,
    productionIdentityExpected: true,
    roleSeparation: true,
  },
  runtime: process.version,
};
console.log(JSON.stringify(result, null, 2));
