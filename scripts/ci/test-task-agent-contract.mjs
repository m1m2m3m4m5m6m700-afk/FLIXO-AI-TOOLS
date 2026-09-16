#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const taskFile = fs.readFileSync('مهام.md', 'utf8');
const contract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const agent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(taskFile.length > 0, 'مهام.md must exist and be non-empty');
assert.match(contract, /preparation-only agent/i);
assert.match(contract, /MUST NOT:\s*[\s\S]*commit source changes[\s\S]*push to GitHub/i);
assert.match(contract, /implementation payload contains \*\*code changes only\*\*/i);
assert.match(agent, /preparedOnly: true/);
assert.match(agent, /NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH/);
assert.match(agent, /مهام\.md/);
assert.equal(packageJson.scripts['agent:task'], 'node scripts/ci/task-agent.mjs');

console.log(JSON.stringify({ status: 'PASS', authority: 'TASK_AGENT_CONTRACT_TEST', checks: 7 }, null, 2));
