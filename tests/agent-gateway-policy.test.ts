import { strict as assert } from 'node:assert';
import { assertPublicAgentBoundary, routeThroughFlixoAgent } from '../src/lib/agent/agent-gateway-policy.ts';

const edit = routeThroughFlixoAgent('remove the background and compress the image');
assert.equal(edit.publicAgent, 'FLIXO_AGENT');
assert.equal(edit.specialist, 'executionAgent');
assert.equal(edit.directSpecialistAccess, false);

const review = routeThroughFlixoAgent('audit this result for security');
assert.equal(review.publicAgent, 'FLIXO_AGENT');
assert.equal(review.specialist, 'reviewAgent');

const ordinary = routeThroughFlixoAgent('hello');
assert.equal(ordinary.publicAgent, 'FLIXO_AGENT');
assert.equal(ordinary.specialist, null);

assert.doesNotThrow(() => assertPublicAgentBoundary('FLIXO_AGENT'));
assert.throws(() => assertPublicAgentBoundary('reviewAgent'), /DIRECT_SPECIALIST_ACCESS_DENIED/);
