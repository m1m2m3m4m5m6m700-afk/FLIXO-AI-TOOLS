#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const taskFile = fs.readFileSync('مهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const execution = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(taskFile.length > 0, 'مهام.md must exist and be non-empty');
assert.match(contract, /execution-enabled|execution agent|Action Ownership/i);
assert.match(contract, /MUST NOT:[\s\S]*disable required security or verification gates[\s\S]*declare GREEN before canonical CI/i);
assert.match(contract, /continue repair cycles[\s\S]*canonical CI is GREEN/i);
assert.match(contract, /Every repair opens a fresh verification cycle/i);
assert.match(contract, /CLOSED \/ VERIFIED.*canonical CI is green/is);
assert.match(agent, /preparedOnly:\s*false|execution-enabled|ACTION_OWNER/i);
assert.match(agent, /ACTIVE_UNTIL_CANONICAL_GREEN/);
assert.match(agent, /rescanAfterEveryRepair: true/);
assert.match(agent, /everyRedCheckMustBecomeARepairTarget: true/);
assert.match(agent, /circuitBreaker:\s*\{[\s\S]*enabled: true,[\s\S]*maxStalledCycles: 3/);
assert.match(agent, /action: 'REQUIRES_REVIEW'/);
assert.match(execution, /status: 'ACTIVE_UNTIL_GREEN'/);
assert.match(execution, /openNewCycleForEveryRedCheck: true/);
assert.match(execution, /closureRequiresCanonicalGreen: true/);
assert.match(execution, /CLOSURE_GATE/);
assert.match(execution, /maxCycles: MAX_REPAIR_CYCLES/);
assert.match(execution, /MAX_STALLED_REPAIR_CYCLES = 3/);
assert.match(execution, /CIRCUIT_BREAKER_OPEN/);
assert.match(execution, /SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS/);
assert.equal(packageJson.scripts['agent:task'], 'node scripts/ci/task-agent.mjs');

console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_CONTRACT_TEST', checks: 22 }, null, 2));
