import assert from 'node:assert/strict';
import { AGENT_DEFINITIONS } from '../src/lib/agent/agent-profile.ts';
import { discoverAgents, validateAgentDiscoveryDefinitions } from '../src/lib/agent/agent-discovery.ts';

validateAgentDiscoveryDefinitions();
assert.ok(AGENT_DEFINITIONS.length > 0);
const execution = discoverAgents({ query: 'execution', runtimeModes: ['NATIVE'] });
assert.equal(execution.validation, 'PASS');
assert.ok(execution.candidates.some((agent) => agent.id === 'executionAgent'));
const review = discoverAgents({ requiredLenses: ['ADVERSARIAL_FALSIFICATION'], runtimeModes: ['READ_ONLY'] });
assert.ok(review.candidates.some((agent) => agent.id === 'reviewAgent'));
const impossible = discoverAgents({ requiredSkills: ['skill-that-does-not-exist'] });
assert.equal(impossible.validation, 'EMPTY');
assert.equal(impossible.authority, 'ADVISORY_ONLY');
console.log(`Agent discovery contract passed: ${AGENT_DEFINITIONS.length} canonical definitions.`);
