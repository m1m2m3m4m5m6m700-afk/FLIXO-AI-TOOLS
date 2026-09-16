#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const taskFile = fs.readFileSync('مهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const execution = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(taskFile.length > 0, 'مهام.md must exist and be non-empty');
assert.match(contract, /preparation-only agent/i);
assert.match(contract, /MUST NOT:\s*[\s\S]*commit source changes[\s\S]*push to GitHub/i);
assert.match(contract, /implementation payload contains \*\*code changes only\*\*/i);
assert.match(contract, /Repairing the reported failure is not task completion/i);
assert.match(contract, /Every red required check becomes a repair target/i);
assert.match(contract, /CLOSED \/ VERIFIED.*canonical CI is green/is);
assert.match(agent, /preparedOnly: true/);
assert.match(agent, /NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH/);
assert.match(agent, /ACTIVE_UNTIL_CANONICAL_GREEN/);
assert.match(agent, /rescanAfterEveryRepair: true/);
assert.match(agent, /everyRedCheckMustBecomeARepairTarget: true/);
assert.match(execution, /status: 'ACTIVE_UNTIL_GREEN'/);
assert.match(execution, /openNewCycleForEveryRedCheck: true/);
assert.match(execution, /closureRequiresCanonicalGreen: true/);
assert.match(execution, /CLOSURE_GATE/);
assert.match(execution, /maxCycles: MAX_REPAIR_CYCLES/);
assert.equal(packageJson.scripts['agent:task'], 'node scripts/ci/task-agent.mjs');

console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_CONTRACT_TEST', checks: 17 }, null, 2));
