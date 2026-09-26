import assert from 'node:assert/strict';
import { solveMath, verifyMathReceipt } from '../src/lib/agent/universal/math-engine.ts';

const cases = new Map([
  ['2 + 3 * 4', 14],
  ['(2 + 3) * 4', 20],
  ['2 ^ 3 ^ 2', 512],
  ['10 / 4', 2.5],
  ['10 % 4', 2],
  ['-5 + 2', -3],
]);
for (const [expression, expected] of cases) {
  const receipt = solveMath({ expression });
  assert.equal(receipt.value, expected);
  assert.equal(verifyMathReceipt(receipt), true);
}
assert.throws(() => solveMath({ expression: '1 / 0' }), /MATH_DIVISION_BY_ZERO/);
assert.throws(() => solveMath({ expression: '2 + Math.max(1, 2)' }), /MATH_EXPRESSION_UNSUPPORTED/);
assert.throws(() => solveMath({ expression: '(2 + 3' }), /MATH_UNBALANCED_PARENS/);
assert.throws(() => solveMath({ expression: '2 / (1 - 1)' }), /MATH_DIVISION_BY_ZERO/);

const receipt = solveMath({ expression: '6 * 7' });
assert.equal(verifyMathReceipt({ ...receipt, value: 43 }), false);
console.log('UNIVERSAL_MATH_ENGINE=PASS');
