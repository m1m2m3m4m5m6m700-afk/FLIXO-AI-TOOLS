import assert from 'node:assert/strict';
import { enforceDeterministicExecutionBoundary } from '../../api/flixo-agent.ts';

const request = 'compress this image under 200KB and convert to WebP';

const clarify = {
  mode: 'clarify',
  reply: 'Please clarify your request.',
  question: 'What should I do?',
  plan: null,
  confidence: 0.4,
};

const bounded = enforceDeterministicExecutionBoundary(request, clarify);
assert.equal(bounded.mode, 'plan');
assert.equal(bounded.question, null);
assert.equal(bounded.reason, 'DETERMINISTIC_QUICKFLOW_AUTHORITY');
assert.ok(bounded.plan);
assert.equal(bounded.plan?.steps.length, 2);
assert.equal(bounded.plan?.steps[0]?.toolId, 'image-compressor');
assert.equal(bounded.plan?.steps[1]?.toolId, 'image-converter');

const incompatible = {
  mode: 'plan',
  reply: 'model plan',
  question: null,
  plan: {
    workflowName: 'wrong',
    confidence: 0.9,
    catalogFingerprint: bounded.plan.catalogFingerprint,
    steps: [{ toolId: 'image-effects', params: { brightness: 150 } }],
  },
  confidence: 0.9,
};
assert.throws(
  () => enforceDeterministicExecutionBoundary(request, incompatible),
  /AI_PLAN_CONFLICTS_WITH_DETERMINISTIC_QUICKFLOW/,
);

const conversational = {
  mode: 'chat',
  reply: 'Hello there.',
  question: null,
  plan: null,
  confidence: 0.99,
};
const conversationalBounded = enforceDeterministicExecutionBoundary('hello', conversational);
assert.equal(conversationalBounded.mode, 'chat');
assert.equal(conversationalBounded.plan, null);

console.log('FLIXO BOT deterministic execution authority contract passed.');
