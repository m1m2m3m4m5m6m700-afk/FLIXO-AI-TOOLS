import assert from 'node:assert/strict';
import { reasonFailure, reasoningPolicy, verificationStrategy } from './auto-repair/reasoning.mjs';

const webkit = reasonFailure([
  'FAIL playwright test: render smoke',
  'Error: WebKit failed to render expected frame',
  'webkit data-render-revision did not advance',
  'at tests/render.spec.ts:42:9',
].join('\n'));

assert.equal(webkit.rootCause, 'webkit-render');
assert.equal(webkit.ambiguity, false);
assert(webkit.causalConfidence >= 0.75);
assert.equal(webkit.sourceMutationAllowed, true);
assert.equal(webkit.decision, 'ALLOW_BOUNDED_MUTATION');
assert(webkit.hypotheses.some((item) => item.id === 'playwright' && item.suppressedBy === 'webkit-render'));
assert.deepEqual(verificationStrategy(['webkit', 'playwright']), [['npm', ['run', 'test:browser']], ['npm', ['run', 'test:static']]);

const lint = reasonFailure('FAIL lint: no-unused-vars in src/example.ts');
assert.equal(lint.rootCause, 'lint');
assert.equal(lint.decision, 'ALLOW_BOUNDED_MUTATION');

const external = reasonFailure('Code scanning AI findings: SessionModelError CAPIError: 400 The requested model is not supported.');
assert.equal(external.rootCause, 'external-tooling');
assert.equal(external.decision, 'BLOCK_EXTERNAL');
assert.equal(external.sourceMutationAllowed, false);
assert.equal(external.causalConfidence, 0.99);

const ambiguous = reasonFailure('playwright page expect(locator) failed Type error TS2322');
assert.equal(ambiguous.decision, 'PROPOSE_ONLY');
assert.equal(ambiguous.ambiguity, true);

assert.equal(reasoningPolicy().principle, 'EVIDENCE_FIRST_CAUSAL_REASONING');

console.log('AUTO_REPAIR_REASONING_SELF_TEST=PASS');
