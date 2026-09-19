import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { reasonFailure, reasoningPolicy, verificationStrategy } from './auto-repair/reasoning.mjs';

const webkit = reasonFailure([
  'FAIL playwright test: render smoke',
  'Error: WebKit failed to render expected frame',
  'webkit data-render-revision did not advance',
  'at tests/render.spec.ts:42:9',
].join('\n'));

assert.equal(webkit.rootCause, 'webkit-render');
assert.equal(webkit.location?.file, 'tests/render.spec.ts');
assert.equal(webkit.location?.line, 42);
assert.equal(webkit.ambiguity, false);
assert(webkit.causalConfidence >= 0.75);
assert.equal(webkit.sourceMutationAllowed, true);
assert.equal(webkit.decision, 'ALLOW_BOUNDED_MUTATION');
assert(webkit.hypotheses.some((item) => item.id === 'playwright' && item.suppressedBy === 'webkit-render'));
assert.deepEqual(verificationStrategy(['webkit', 'playwright']), [['npm', ['run', 'test:browser']], ['npm', ['run', 'test:static']]]);

const lint = reasonFailure('ERROR eslint: no-unused-vars at scripts/ci/test-auto-repair-reasoning.mjs:10:3');
assert.equal(lint.rootCause, 'lint');
assert.equal(lint.location?.file, 'scripts/ci/test-auto-repair-reasoning.mjs');
assert.equal(lint.location?.line, 10);
assert.equal(lint.locationVerified, true);
assert.equal(lint.decision, 'ALLOW_BOUNDED_MUTATION');

const missingSource = reasonFailure('ERROR eslint: no-unused-vars at does/not/exist.ts:10:3');
assert.equal(missingSource.locationVerified, false);
assert.equal(missingSource.decision, 'PROPOSE_ONLY');

const external = reasonFailure('Code scanning AI findings: SessionModelError CAPIError: 400 The requested model is not supported.');
assert.equal(external.rootCause, 'external-tooling');
assert.equal(external.decision, 'BLOCK_EXTERNAL');
assert.equal(external.sourceMutationAllowed, false);
assert.equal(external.causalConfidence, 0.99);

const ambiguous = reasonFailure('playwright page expect(locator) failed Type error TS2322');
assert.equal(ambiguous.decision, 'PROPOSE_ONLY');
assert.equal(ambiguous.ambiguity, true);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-reasoning-'));
execFileSync('git', ['init', '-q'], { cwd: tempDir });
execFileSync('git', ['config', 'user.name', 'reasoning-test'], { cwd: tempDir });
execFileSync('git', ['config', 'user.email', 'reasoning-test@example.invalid'], { cwd: tempDir });
fs.writeFileSync(path.join(tempDir, 'a.ts'), 'export const value = 1;\n');
execFileSync('git', ['add', '.'], { cwd: tempDir });
execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: tempDir });
const tempSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).trim();
const scoutPath = path.join(tempDir, 'scout.json');
fs.writeFileSync(scoutPath, JSON.stringify({ scannedSha: tempSha, findings: [] }));
const freshScout = reasonFailure('ERROR eslint: no-unused-vars at a.ts:1:1', { targetDir: tempDir, scoutPath });
assert.equal(freshScout.scout.fresh, true);
assert.equal(freshScout.scout.scannedSha, tempSha);
fs.writeFileSync(scoutPath, JSON.stringify({ scannedSha: 'a'.repeat(40), findings: [] }));
const staleScout = reasonFailure('ERROR eslint: no-unused-vars at a.ts:1:1', { targetDir: tempDir, scoutPath });
assert.equal(staleScout.scout.fresh, false);
assert.equal(staleScout.scout.reason, 'stale');

const fallbackScoutPath = path.join(tempDir, 'fallback-scout.json');
fs.writeFileSync(fallbackScoutPath, JSON.stringify({ scannedSha: tempSha, findings: [] }));
const originalScoutEnv = process.env.FLIXO_SCOUT_REPORT;
process.env.FLIXO_SCOUT_REPORT = fallbackScoutPath;
const fallbackScout = reasonFailure('ERROR eslint: no-unused-vars at a.ts:1:1', { targetDir: tempDir, scoutPath: undefined });
assert.equal(fallbackScout.scout.fresh, true);
assert.equal(fallbackScout.scout.path, fallbackScoutPath);
if (originalScoutEnv === undefined) delete process.env.FLIXO_SCOUT_REPORT; else process.env.FLIXO_SCOUT_REPORT = originalScoutEnv;

const missingSignal = reasonFailure('Certification execution graph incomplete DEEP_SEMANTIC_MISSING=webkit:DEEP:webkit:ja');
assert.equal(missingSignal.directFailureSignal, true);


assert.equal(reasoningPolicy().principle, 'EVIDENCE_FIRST_CAUSAL_REASONING');

console.log('AUTO_REPAIR_REASONING_SELF_TEST=PASS');
