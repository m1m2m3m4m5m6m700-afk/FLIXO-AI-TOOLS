#!/usr/bin/env node
import fs from 'node:fs';

const required = [
  'مهام.md',
  'docs/agents/TASK-AGENT.md',
  'docs/agents/TASK-AGENT-SYSTEM-PROMPT.md',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/test-task-agent-contract.mjs',
  'docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md',
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`TASK_AGENT_REQUIRED_FILE_MISSING=${file}`);
}
const task = fs.readFileSync('مهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const scope = fs.readFileSync('docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md', 'utf8');

for (const marker of [
  'Direct Repair Contract',
  'self-healing repair agent only',
  'DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH',
  'SELF_HEALING_REPAIR_ONLY',
  'FAIL_CLOSED',
  'Canonical CI',
]) {
  if (!contract.includes(marker)) throw new Error(`TASK_AGENT_CONTRACT_MARKER_MISSING=${marker}`);
}

for (const marker of [
  'Exact-SHA Evidence',
  'Canonical CI GREEN',
  'No execution before confirmation',
  'auto-merge',
]) {
  if (!task.includes(marker)) throw new Error(`TASK_AGENT_TASK_GATE_MARKER_MISSING=${marker}`);
}

for (const marker of [
  'DIRECT_EXECUTION',
  'DIRECT_ON_ISOLATED_REPAIR_BRANCH',
  'DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH',
  'SELF_HEALING_REPAIR_ONLY',
  'FAIL_CLOSED',
  'mainBranchMutation: false',
]) {
  if (!agent.includes(marker)) throw new Error(`TASK_AGENT_EXECUTION_MARKER_MISSING=${marker}`);
}

for (const marker of [
  'SELF-HEALING AGENT ONLY',
  'Out-of-scope work is forbidden',
  'Direct-execution boundary',
  'scopePolicy: SELF_HEALING_REPAIR_ONLY',
  'scopeEnforcement: FAIL_CLOSED',
]) {
  if (!scope.includes(marker)) throw new Error(`TASK_AGENT_SCOPE_MARKER_MISSING=${marker}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  authority: 'TASK_AGENT_DIRECT_REPAIR_OWNER',
  runtimeModel: 'DIRECT_EXECUTION_ON_ISOLATED_REPAIR_BRANCH',
  scopePolicy: 'SELF_HEALING_REPAIR_ONLY',
  scopeEnforcement: 'FAIL_CLOSED',
  requiredFiles: required.length,
}, null, 2));
