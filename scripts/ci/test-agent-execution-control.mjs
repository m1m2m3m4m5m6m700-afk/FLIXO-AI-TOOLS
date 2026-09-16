#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
assert.match(source, /singleOrchestrator: true/);
assert.match(source, /specializedRolesAreStages: true/);
assert.match(source, /failClosed: true/);
assert.match(source, /maxPreparedFiles: 12/);
assert.match(source, /maxInspectedFiles: 40/);
assert.match(source, /STALE_BASELINE/);
assert.match(source, /NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH/);
assert.match(source, /READY_FOR_EXECUTION/);
console.log(JSON.stringify({ status: 'PASS', authority: 'LEAN_AGENT_EXECUTION_CONTROL_TEST', checks: 8 }, null, 2));
