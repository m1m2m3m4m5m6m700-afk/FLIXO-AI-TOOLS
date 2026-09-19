#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
assert.match(source, /singleOrchestrator: true/);
assert.match(source, /specializedRolesAreStages: true/);
assert.match(source, /failClosed: true/);
assert.match(source, /MAX_PREPARED_FILES = 12/);
assert.match(source, /maxInspectedFiles: 40/);
assert.match(source, /MAX_REPAIR_CYCLES = 12/);
assert.match(source, /MAX_STALLED_REPAIR_CYCLES = 3/);
assert.match(source, /MAX_PREPARED_FILES = 8/);
assert.match(source, /STALE_BASELINE/);
assert.match(source, /mainBranchMutation: false/);
assert.match(source, /DIRECT_ON_EXECUTION_BRANCH/);
assert.match(source, /ACTIVE_UNTIL_GREEN/);
assert.match(source, /COGNITION_CONTEXT_MISSING/);
console.log(JSON.stringify({ status: 'PASS', authority: 'LEAN_AGENT_EXECUTION_CONTROL_TEST', checks: 8 }, null, 2));
