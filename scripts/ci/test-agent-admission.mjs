#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const session = fs.readFileSync('scripts/ci/agent-session.mjs', 'utf8');
const repair = fs.readFileSync('scripts/ci/repair-protocol.mjs', 'utf8');
const task = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const taskContract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const safeExecution = fs.readFileSync('docs/agents/SAFE-TASK-AGENT-EXECUTION.md', 'utf8');
const prompts = JSON.parse(fs.readFileSync('docs/agents/PROMPT-REGISTRY.json', 'utf8'));
const cooperation = JSON.parse(fs.readFileSync('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json', 'utf8'));
const protocolRegistry = JSON.parse(fs.readFileSync('docs/PROTOCOL-REGISTRY.json', 'utf8'));

const requiredReads = [
  'PROJECTS.md',
  'المهام.md',
  'AGENTS.md',
  'docs/EXECUTION-BRANCH-PROTOCOL.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md',
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'docs/PROTOCOL-HIERARCHY.md',
  'docs/PROTOCOL-REGISTRY.json',
  'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json',
  'docs/agents/PROMPT-REGISTRY.json',
  'diagnostics/auto-repair/memory.json',
  'scripts/ci/agent-communication.mjs',
  'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md',
  'scripts/ci/test-plan.json',
  'scripts/ci/assertion-registry.json',
];

for (const file of requiredReads) {
  assert.ok(session.includes(file), 'session admission must require ' + file);
}

assert.ok(session.includes('loadPromptRegistry'));
assert.ok(session.includes('validatePromptRegistry'));
assert.ok(session.includes('loadErrorMemory'));
assert.ok(session.includes('readCanonicalAdmissionSources'));
assert.ok(session.includes('admissionSources'));

for (const role of ["'repairAgent'", "'executionAgent'", "'assistantRepairAgent'"]) assert.ok(repair.includes(role));
assert.ok(repair.includes('primaryAgentsUnavailable'));
assert.ok(repair.includes('minConfidence: 0.90'));
assert.ok(repair.includes('minSupport: 2'));
assert.ok(!repair.includes("mutationAgents: ['repairAgent','implementation','executionAgent','taskAgent']"));
assert.ok(!repair.includes("mutationAgents: ['repairAgent','implementation','executionAgent']"));

assert.ok(task.includes("actor: 'taskAgent'"));
assert.ok(task.includes('preparedOnly: true'));
assert.ok(task.includes("executionMode: 'PREPARATION_ONLY'"));
assert.ok(task.includes("mutationPolicy: 'NO_DIRECT_MUTATION'"));
assert.ok(task.includes("const executionAuthority = 'TASK_PREPARATION_ONLY';"));
assert.ok(task.includes("TASK-AGENT-PREPARATION-v3"));
assert.ok(task.includes("applyAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT'"));

assert.ok(taskContract.includes('preparation-only'));
assert.ok(taskContract.includes('MUST NOT'));
assert.ok(taskContract.includes('mutate repository source'));

assert.ok(safeExecution.includes('Task Agent is explicitly not a mutation role'));

const legacy = prompts.prompts.find((item) => item.promptId === 'RPR-EXISTING-SAFE-TASK-001');
assert.equal(legacy?.status, 'DEPRECATED');
assert.deepEqual(legacy?.supersededBy, ['RPR-EXISTING-TASK-PREP-001']);

assert.equal(cooperation.schemaVersion, 5);
assert.ok(cooperation.protocols.communication_first);
assert.ok(cooperation.protocols.message_idempotency);
assert.ok(cooperation.protocols.message_freshness);
assert.equal(protocolRegistry.protocols.find((item) => item.id === 'P20')?.status, 'MANDATORY');

console.log('AGENT_ADMISSION_CONTRACT=PASS');
console.log('TASK_AGENT_MUTATION_AUTHORITY=BLOCKED');
console.log('CANONICAL_READ_SET=ENFORCED');
console.log('PROMPT_AND_MEMORY_ADMISSION=ENFORCED');
