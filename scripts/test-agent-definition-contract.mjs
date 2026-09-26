import assert from 'node:assert/strict';
import {
  AGENT_DEFINITIONS,
  createAgentDefinition,
  getAgentDefinition,
  listAgentDefinitions,
} from '../src/lib/agent/agent-profile.ts';

assert.ok(AGENT_DEFINITIONS.length > 0);
assert.equal(listAgentDefinitions().length, AGENT_DEFINITIONS.length);
assert.equal(new Set(AGENT_DEFINITIONS.map((definition) => definition.id)).size, AGENT_DEFINITIONS.length);
assert.equal(new Set(AGENT_DEFINITIONS.map((definition) => definition.name)).size, AGENT_DEFINITIONS.length);

for (const definition of AGENT_DEFINITIONS) {
  assert.equal(definition.profileId, definition.id);
  assert.equal(definition.authorityBinding, 'CANONICAL_CONTROL_PLANE');
  assert.equal(definition.doesNotGrantAuthority, true);
  assert.equal(getAgentDefinition(definition.id)?.id, definition.id);
}

const execution = createAgentDefinition('executionAgent', {
  handoffDescription: 'Canonical verified user-intent execution.',
});
assert.equal(execution.id, 'executionAgent');
assert.equal(execution.handoffDescription, 'Canonical verified user-intent execution.');

assert.throws(
  () => createAgentDefinition('missing-agent'),
  /UNKNOWN_AGENT_PROFILE/,
);
assert.throws(
  () => createAgentDefinition('executionAgent', {
    name: 'another-name',
    handoffDescription: 'collision',
  }),
  /AGENT_DEFINITION_COLLISION/,
);

console.log(`Agent definition contract passed: ${AGENT_DEFINITIONS.length} canonical definitions.`);
