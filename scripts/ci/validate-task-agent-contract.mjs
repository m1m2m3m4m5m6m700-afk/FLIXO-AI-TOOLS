#!/usr/bin/env node
import fs from 'node:fs';

const required = [
  'المهام.md',
  'docs/agents/TASK-AGENT.md',
  'docs/agents/TASK-AGENT-SYSTEM-PROMPT.md',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/test-task-agent-contract.mjs',
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`TASK_AGENT_REQUIRED_FILE_MISSING=${file}`);
}

const task = fs.readFileSync('المهام.md', 'utf8');
const ownershipContract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');

// `المهام.md` remains the task-intelligence source of truth. Execution ownership
// is authoritative in TASK-AGENT.md so the task ledger does not duplicate
// mutable execution permissions.
for (const marker of [
  'TASK AGENT — OWNER OF THIS FILE',
  'Prepared Changes / Patch Plan',
  'الوكيل التنفيذي',
]) {
  if (!task.includes(marker)) throw new Error(`TASK_AGENT_TASK_GATE_MARKER_MISSING=${marker}`);
}

for (const marker of [
  'Action Ownership',
  'continue repair cycles',
  'declare GREEN before canonical CI',
  'COMMIT / PUSH',
  'push verified changes',
]) {
  if (!ownershipContract.includes(marker)) throw new Error(`TASK_AGENT_OWNERSHIP_CONTRACT_MARKER_MISSING=${marker}`);
}

// Push authority is intentionally bounded by the canonical repair contract:
// the agent may push verified changes to the configured repair branch, while
// direct main mutation is permitted only when the workflow contract explicitly
// authorizes it. The validator must not impose a conflicting PREPARATION_ONLY
// restriction on an execution-enabled Task Agent.
if (!/configured repair branch/.test(ownershipContract)) {
  throw new Error('TASK_AGENT_OWNERSHIP_CONTRACT_MISSING_BOUNDED_PUSH_SCOPE');
}
if (!/workflow contract explicitly authorizes direct repair/.test(ownershipContract)) {
  throw new Error('TASK_AGENT_OWNERSHIP_CONTRACT_MISSING_MAIN_GUARD');
}

console.log(JSON.stringify({
  status: 'PASS',
  authority: 'TASK_AGENT_ACTION_OWNER',
  taskSourceOfTruth: 'المهام.md',
  executionOwnershipSource: 'docs/agents/TASK-AGENT.md',
  pushScope: 'CONFIGURED_REPAIR_BRANCH_OR_EXPLICITLY_AUTHORIZED_MAIN',
  requiredFiles: required.length,
}, null, 2));
