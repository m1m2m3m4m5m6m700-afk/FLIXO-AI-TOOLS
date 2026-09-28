import { strict as assert } from 'node:assert';
import { routeUserRequestThroughFlixoAgent, assertNoDirectSpecialistInvocation } from '../src/lib/agent/flixo-agent-orchestrator.ts';
import { AgentRequestSchema } from '../src/lib/contracts/agent-gateway.ts';

const routed = routeUserRequestThroughFlixoAgent('remove the background and convert to png');
assert.equal(routed.routing.publicAgent, 'FLIXO_AGENT');
assert.equal(routed.routing.directSpecialistAccess, false);
assert.equal(routed.routing.specialist, 'executionAgent');
assert.ok(Array.isArray(routed.models));

assert.doesNotThrow(() => assertNoDirectSpecialistInvocation('FLIXO_AGENT'));
assert.throws(() => assertNoDirectSpecialistInvocation('executionAgent'), /DIRECT_SPECIALIST_ACCESS_DENIED/);

assert.throws(() => AgentRequestSchema.parse({
  messages: [{ role: 'user', content: 'compress this image' }],
  specialist: 'executionAgent',
}), /Unrecognized key/);
