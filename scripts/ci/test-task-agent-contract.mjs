#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const taskFile = fs.readFileSync('المهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const execution = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
const repairProtocol = fs.readFileSync('scripts/ci/repair-protocol.mjs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(taskFile.length > 0, 'المهام.md must exist and be non-empty');

for (const text of [contract, taskFile]) {
  assert.match(text, /preparation-only/i);
  assert.match(text, /MUST NOT/i);
  assert.match(text, /mutate/i);
}

assert.ok(agent.includes("actor: 'taskAgent'"));
assert.ok(agent.includes("preparedOnly: true"));
assert.ok(agent.includes("executionMode: 'PREPARATION_ONLY'"));
assert.ok(agent.includes("mutationPolicy: 'NO_DIRECT_MUTATION'"));
assert.ok(agent.includes("const executionAuthority = 'TASK_PREPARATION_ONLY';"));
assert.ok(agent.includes('executionAuthority,\n    mutationScope'));
assert.ok(agent.includes("TASK-AGENT-PREPARATION-v4-ISOLATED-WORKSPACE"));
assert.ok(agent.includes("applyAuthority: 'CHAIR_1'"));
assert.ok(!agent.includes('TASK_AGENT_DIRECT_EXECUTION'));
assert.ok(!agent.includes('TASK_AGENT_ON_EXECUTION_BRANCH_ONLY'));

assert.ok(execution.includes('TASK_AGENT_CONTRACT_VERSION = \'TASK-AGENT-PREPARATION-v4-ISOLATED-WORKSPACE\''));
assert.ok(execution.includes("preparedOnly !== true"));
assert.ok(execution.includes("executionMode !== 'PREPARATION_ONLY'"));
assert.ok(execution.includes("packet.executionAuthority !== 'TASK_PREPARATION_ONLY'"));
assert.ok(execution.includes("packet.mutationPolicy !== 'NO_DIRECT_MUTATION'"));
assert.ok(execution.includes("REPAIR_AGENT_OR_EXECUTION_AGENT"));

for (const role of ["'repairAgent'", "'executionAgent'", "'assistantRepairAgent'"]) assert.ok(repairProtocol.includes(role));
assert.ok(repairProtocol.includes('primaryAgentsUnavailable'));
assert.ok(repairProtocol.includes('minConfidence: 0.90'));
assert.ok(repairProtocol.includes('minSupport: 2'));
assert.ok(!repairProtocol.includes("mutationAgents: ['repairAgent','implementation','executionAgent','taskAgent']"));

assert.equal(packageJson.scripts['agent:task'], 'node scripts/ci/task-agent.mjs');
assert.equal(packageJson.scripts['test:agent-admission'], 'node scripts/ci/test-agent-admission.mjs');

console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_PREPARATION_CONTRACT_TEST', checks: 20 }, null, 2));
