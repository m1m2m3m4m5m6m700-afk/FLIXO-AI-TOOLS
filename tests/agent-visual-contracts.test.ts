import test from 'node:test';
import assert from 'node:assert/strict';
import { isAcceptedEvaluation } from '../src/lib/agent/visual-evaluator.ts';
import { runBoundedRefinement } from '../src/lib/agent/refinement-loop.ts';

test('acceptance requires all evaluator dimensions', () => {
  assert.equal(isAcceptedEvaluation({ artifactValid:true, structureValid:true, pixelValid:true, goalSatisfied:true, reasons:[] }), true);
  assert.equal(isAcceptedEvaluation({ artifactValid:true, structureValid:true, pixelValid:true, goalSatisfied:false, reasons:['goal'] }), false);
});

test('refinement is bounded and fails closed', () => {
  assert.equal(runBoundedRefinement([], { maxAttempts: 2, maxMutations: 2, maxMilliseconds: 1000 }), null);
  assert.equal(runBoundedRefinement([{
    attempt: 1, planId: 'p1',
    evaluation: { artifactValid:true, structureValid:true, pixelValid:true, goalSatisfied:true, reasons:[] },
  }], { maxAttempts: 2, maxMutations: 2, maxMilliseconds: 1000 })?.planId, 'p1');
});
