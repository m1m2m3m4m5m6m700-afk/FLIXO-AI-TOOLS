#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const taskFile = fs.readFileSync('مهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const prompt = fs.readFileSync('docs/agents/TASK-AGENT-SYSTEM-PROMPT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const execution = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(taskFile.length > 0, 'مهام.md must exist and be non-empty');
assert.match(contract, /Safe Action Ownership Contract/i);
assert.match(contract, /Direct mutation of `main` is forbidden/i);
assert.match(contract, /repair branch/i);
assert.match(contract, /Every repair opens another verification cycle/i);
assert.match(contract, /CLOSED \/ VERIFIED.*canonical GREEN/is);
assert.match(prompt, /Execution System Prompt/i);
assert.match(prompt, /PREPARATION_ONLY.*forbidden/is);
assert.match(prompt, /Direct mutation of `main` is forbidden/i);
assert.match(agent, /mode: 'REPAIR_BRANCH_EXECUTION'/);
assert.match(agent, /preparedOnly: false/);
assert.match(agent, /REPAIR_BRANCH_ONLY_NO_DIRECT_MAIN_MUTATION/);
assert.match(agent, /directMainPush: false/);
assert.match(agent, /ACTIVE_UNTIL_CANONICAL_GREEN/);
assert.match(agent, /rescanAfterEveryRepair: true/);
assert.match(agent, /everyRedCheckMustBecomeARepairTarget: true/);
assert.match(agent, /maxStalledCycles: 3/);
assert.match(agent, /action: 'REQUIRES_REVIEW'/);
assert.doesNotMatch(agent, /PREPARATION_ONLY/);
assert.doesNotMatch(agent, /NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH/);
assert.doesNotMatch(agent, /SUPERVISING_AGENT_ONLY/);
assert.match(execution, /status: 'ACTIVE_UNTIL_GREEN'/);
assert.match(execution, /openNewCycleForEveryRedCheck: true/);
assert.match(execution, /closureRequiresCanonicalGreen: true/);
assert.match(execution, /CLOSURE_GATE/);
assert.match(execution, /maxCycles: MAX_REPAIR_CYCLES/);
assert.match(execution, /MAX_STALLED_REPAIR_CYCLES = 3/);
assert.match(execution, /CIRCUIT_BREAKER_OPEN/);
assert.match(execution, /SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS/);
assert.equal(packageJson.scripts['agent:task'], 'node scripts/ci/task-agent.mjs');

console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_CONTRACT_TEST', mode: 'REPAIR_BRANCH_EXECUTION', directMainMutation: false, checks: 27 }, null, 2));
