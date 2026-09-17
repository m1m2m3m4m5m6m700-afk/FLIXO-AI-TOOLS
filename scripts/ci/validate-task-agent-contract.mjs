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
// is deliberately authoritative in TASK-AGENT.md so the task ledger can remain
// a plan/state document without duplicating mutable execution permissions.
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
  'pushAuthority',
]) {
  if (!ownershipContract.includes(marker)) throw new Error(`TASK_AGENT_OWNERSHIP_CONTRACT_MARKER_MISSING=${marker}`);
}

// The preparation agent is intentionally forbidden from pushing; push authority
// belongs to the supervising execution agent. Validate both sides explicitly.
if (!/ممنوع\s+`git push`/.test(ownershipContract) && !ownershipContract.includes('ممنوع `git push`')) {
  throw new Error('TASK_AGENT_OWNERSHIP_CONTRACT_MISSING_PREPARATION_PUSH_RESTRICTION');
}

console.log(JSON.stringify({
  status: 'PASS',
  authority: 'TASK_AGENT_ACTION_OWNER',
  taskSourceOfTruth: 'المهام.md',
  executionOwnershipSource: 'docs/agents/TASK-AGENT.md',
  requiredFiles: required.length,
}, null, 2));
