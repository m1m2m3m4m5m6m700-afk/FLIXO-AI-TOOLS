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
for (const marker of [
  'TASK AGENT — OWNER OF THIS FILE',
  'Prepared Changes / Patch Plan',
  'الوكيل التنفيذي',
  'Action Ownership',
  'git push',
]) {
  if (!task.includes(marker)) throw new Error(`TASK_AGENT_TASK_GATE_MARKER_MISSING=${marker}`);
}
console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_ACTION_OWNER', requiredFiles: required.length }, null, 2));
