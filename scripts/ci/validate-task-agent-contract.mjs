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
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const prompt = fs.readFileSync('docs/agents/TASK-AGENT-SYSTEM-PROMPT.md', 'utf8');
const implementation = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
for (const marker of ['TASK AGENT — OWNER OF THIS FILE', 'Action Ownership', 'git push']) {
  if (!task.includes(marker)) throw new Error(`TASK_AGENT_TASK_GATE_MARKER_MISSING=${marker}`);
}
for (const marker of ['Safe Action Ownership Contract', 'REPAIR BRANCH', 'Direct mutation of `main` is forbidden']) {
  if (!contract.includes(marker)) throw new Error(`TASK_AGENT_CONTRACT_MARKER_MISSING=${marker}`);
}
for (const marker of ['Execution System Prompt', 'REPAIR BRANCH', 'canonical exact-SHA GREEN']) {
  if (!prompt.includes(marker)) throw new Error(`TASK_AGENT_PROMPT_MARKER_MISSING=${marker}`);
}
for (const forbidden of ['mode: \'PREPARATION_ONLY\'', 'preparedOnly: true', 'NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH', 'SUPERVISING_AGENT_ONLY', 'push directly to `main`']) {
  if (implementation.includes(forbidden) || contract.includes(forbidden) || prompt.includes(forbidden)) {
    throw new Error(`TASK_AGENT_LEGACY_PREPARATION_MARKER=${forbidden}`);
  }
}
for (const requiredMode of ['REPAIR_BRANCH_EXECUTION', 'REPAIR_BRANCH_ONLY_NO_DIRECT_MAIN_MUTATION']) {
  if (!implementation.includes(requiredMode)) throw new Error(`TASK_AGENT_EXECUTION_MARKER_MISSING=${requiredMode}`);
}
console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_ACTION_OWNER', mode: 'REPAIR_BRANCH_EXECUTION', directMainMutation: false, requiredFiles: required.length }, null, 2));
