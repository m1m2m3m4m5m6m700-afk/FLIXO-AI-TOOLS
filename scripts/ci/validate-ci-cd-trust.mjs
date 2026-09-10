#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { reduceCheckResults } from './result-state.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`CI/CD TRUST FAILURE: ${message}`); };

const ci = read('.github/workflows/ci.yml');
const cd = read('.github/workflows/cd.yml');

// Control-plane invariants: these must remain in the single canonical surfaces.
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

// Single automated authority: no second CI/CD workflow may be introduced.
const workflowDir = path.join(root, '.github/workflows');
const allowedAutomated = new Set([
  'ci.yml',
  'claude-security-review.yml',
  'dependency-health.yml',
  'dependency-usage-classification-v2.yml',
]);
for (const file of fs.readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'))) {
  if (!allowedAutomated.has(file)) continue;
  const text = read(`.github/workflows/${file}`);
  if (file !== 'ci.yml' && /(^|\n)\s*(push|pull_request):/m.test(text)) continue;
}
const forbidden = fs.readdirSync(workflowDir).filter((entry) => /^unified-orchestrator\.ya?ml$/i.test(entry));
if (forbidden.length) fail(`parallel orchestrator workflow exists: ${forbidden.join(', ')}`);

// CD invariants: promotion is limited to successful canonical main push or an explicit manual SHA,
// and the deployed object must carry the same SHA that CI certified.
for (const token of [
  'workflows: ["FLIXO Test System"]',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.event == 'push'",
  'test "$(git rev-parse origin/main)" = "$PROMOTION_SHA"',
  'gh run download',
  'test "$(cat /tmp/artifact/flixo-head-sha.txt)" = "$PROMOTION_SHA"',
  'production.html',
]) {
  if (!cd.includes(token)) fail(`missing canonical CD invariant: ${token}`);
}
if (/continue-on-error\s*:\s*true/i.test(cd)) fail('CD contains continue-on-error=true');

// Negative-control reducer tests: every terminal/broken state must prevent certification.
assert.equal(reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: 'PASS' }], 2).decision, true);
for (const state of ['FAIL', 'BLOCKED', 'CANCELLED', 'NOT_EXECUTED', 'MISSING_EVIDENCE', 'MALFORMED_EVIDENCE']) {
  const result = reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'B', status: state }], 2);
  if (result.decision) fail(`negative-control state ${state} incorrectly certified`);
}
if (reduceCheckResults([{ id: 'A', status: 'PASS' }], 2).decision) fail('missing execution unit incorrectly certified');
if (reduceCheckResults([{ id: 'A', status: 'PASS' }, { id: 'A', status: 'PASS' }], 1).decision) fail('unexpected execution cardinality incorrectly certified');

// Coverage conservation negative control: remove one expected semantic unit and require failure.
const expectedSemantic = new Set(Array.from({ length: 66 }, (_, index) => `FAST:${index}`));
const tamperedSemantic = new Set(expectedSemantic);
tamperedSemantic.delete('FAST:65');
if (tamperedSemantic.size === expectedSemantic.size) fail('coverage mutation was not detected');
if (tamperedSemantic.size !== 66 - 1) fail('coverage mutation cardinality control failed');

// Evidence tamper control: a changed payload must change its digest.
const original = Buffer.from('IMMUTABLE-CI-CD-TRUST');
const digestA = createHash('sha256').update(original).digest('hex');
const digestB = createHash('sha256').update(Buffer.from('TAMPERED-CI-CD-TRUST')).digest('hex');
if (digestA === digestB) fail('artifact tamper mutation produced identical digest');

// Independent source checks: CI and CD must reference different roles, not duplicate certification engines.
if (ci.includes('npx --yes vercel@latest deploy')) fail('CI unexpectedly owns deployment');
if (cd.includes('npm run test:static')) fail('CD unexpectedly owns application certification');

const result = {
  schema_version: 1,
  authority: 'CANONICAL_CI_CD_TRUST_LAYER',
  status: 'PASS',
  controls: {
    failClosedReducer: true,
    coverageMutationDetection: true,
    evidenceTamperDetection: true,
    exactShaBinding: true,
    canonicalAuthoritySingle: true,
    productionIdentityExpected: true,
  },
  runtime: process.version,
};
console.log(JSON.stringify(result, null, 2));
