import test from 'node:test';
import assert from 'node:assert/strict';
import { combineCoverage, createCoverage, invertCoverage } from '../src/lib/editor/masks/index.ts';

test('coverage fields stay bounded and composable', () => {
  const left = createCoverage(2, 1, 0.75);
  const right = createCoverage(2, 1, 0.5);
  assert.deepEqual([...combineCoverage(left, right, 'add').values], [1, 1]);
  assert.deepEqual([...combineCoverage(left, right, 'subtract').values], [0.25, 0.25]);
  assert.deepEqual([...invertCoverage(right).values], [0.5, 0.5]);
});

test('rejects mismatched mask dimensions', () => {
  assert.throws(() => combineCoverage(createCoverage(2, 2), createCoverage(1, 2), 'multiply'), /MASK_DIMENSIONS_MISMATCH/);
});
