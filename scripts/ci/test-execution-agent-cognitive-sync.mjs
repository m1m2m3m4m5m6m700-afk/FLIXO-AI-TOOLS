#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildExecutionAgentCloneContext, EXECUTION_AGENT_CLONE_ID, EXECUTION_AGENT_CLONE_ROLE, FLIXO_BOT_BRAIN_VERSION, COGNITIVE_MESH_PROTOCOL } from './execution-agent-cognitive-sync.mjs';

const context = buildExecutionAgentCloneContext({ targetSha: process.env.FLIXO_TARGET_SHA });
assert.equal(context.protocol, COGNITIVE_MESH_PROTOCOL);
assert.equal(context.cloneId, EXECUTION_AGENT_CLONE_ID);
assert.equal(context.role, EXECUTION_AGENT_CLONE_ROLE);
assert.equal(context.brain.version, FLIXO_BOT_BRAIN_VERSION);
assert.ok(context.brain.capabilityCount >= 1);
assert.equal(context.sync.cloneToSystem, true);
assert.equal(context.sync.systemToClone, true);
assert.equal(context.sync.allActiveConsumersShareTheSameBrain, true);
assert.equal(context.sync.allActiveConsumersShareTheSameMemory, true);
assert.equal(context.sync.knowledgeOnly, true);
assert.equal(context.sync.noAuthorityTransfer, true);
console.log('EXECUTION_AGENT_CLONE_COGNITIVE_MESH_TEST=PASS');
