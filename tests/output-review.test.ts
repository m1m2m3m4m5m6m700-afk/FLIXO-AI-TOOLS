import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewOutputBasics } from '../src/lib/agent/output-review.ts';

test('output review rejects empty artifacts and remains advisory', () => {
  const review = reviewOutputBasics(new Blob([new Uint8Array([1])], { type: 'image/png' }), new Blob([], { type: 'image/png' }));
  assert.equal(review.passed, false);
  assert.equal(review.advisory, true);
  assert.ok(review.reasons.includes('OUTPUT_EMPTY'));
});

test('output review accepts a normal non-empty artifact', () => {
  const input = new Blob([new Uint8Array(100)], { type: 'image/png' });
  const output = new Blob([new Uint8Array(80)], { type: 'image/png' });
  const review = reviewOutputBasics(input, output);
  assert.equal(review.passed, true);
  assert.equal(review.advisory, true);
});
