import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const logPath = '/tmp/flixo-diagnosis-fixture.log';
const evidencePath = '/tmp/flixo-root-cause.json';

fs.writeFileSync(logPath, [
  'FAIL playwright test: render smoke',
  'Error: WebKit failed to render expected frame',
  'webkit data-render-revision did not advance',
  'at tests/render.spec.ts:42:9',
].join('\n'));

execFileSync(process.execPath, ['scripts/ci/auto-repair-classifier.mjs'], {
  env: { ...process.env, FLIXO_FAILURE_LOG: logPath },
  stdio: 'pipe',
});

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.equal(evidence.rootCause, 'webkit-render');
assert.equal(evidence.diagnosisQuality, 'strong');
assert.equal(evidence.directFailureSignal, true);
assert.equal(evidence.ambiguity, false);
assert.ok(evidence.causalConfidence >= 0.75);
assert.ok(evidence.hypotheses.some((item) => item.id === 'playwright'));

fs.writeFileSync(logPath, 'Type error TS2345 at src/example.ts:10:3');
execFileSync(process.execPath, ['scripts/ci/auto-repair-classifier.mjs'], {
  env: { ...process.env, FLIXO_FAILURE_LOG: logPath },
  stdio: 'pipe',
});
const weakEvidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.equal(weakEvidence.rootCause, 'typescript');
assert.notEqual(weakEvidence.diagnosisQuality, 'strong');

console.log('auto-repair diagnosis evidence gate: PASS');
