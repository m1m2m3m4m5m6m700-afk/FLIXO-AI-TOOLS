#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8');
assert.match(source, /singleOrchestrator: true/);
assert.match(source, /MAJOR_MAX_REPAIR_CYCLES = 30/);
assert.match(source, /MAJOR_MAX_PREPARED_FILES = 60/);
assert.match(source, /MAJOR_MAX_INSPECTED_FILES = 240/);
assert.match(source, /FLIXO_MAJOR_REPAIR_WAVE/);
assert.match(source, /specializedRolesAreStages: true/);
assert.match(source, /failClosed: true/);
assert.match(source, /NORMAL_MAX_PREPARED_FILES = 12/);
assert.match(source, /NORMAL_MAX_INSPECTED_FILES = 40/);
assert.match(source, /NORMAL_MAX_REPAIR_CYCLES = 12/);
assert.match(source, /MAX_STALLED_REPAIR_CYCLES = 3/);
assert.match(source, /MAX_PREPARED_FILES = 12/);
assert.match(source, /STALE_BASELINE/);
assert.match(source, /mainBranchMutation: false/);
assert.match(source, /DIRECT_ON_EXECUTION_BRANCH/);
assert.match(source, /ACTIVE_UNTIL_GREEN/);
assert.match(source, /COGNITION_CONTEXT_MISSING/);
assert.match(source, /BOUND_ADMIN_ON_EXECUTION_WITH_ERROR_SCOPE/);
assert.match(source, /CURRENT_FAILURE_ROOT_CAUSE_AND_PROPORTIONAL_HARDENING_ONLY/);
assert.match(source, /HUMAN_COMMAND_DEPENDENCY_VIOLATION/);
console.log(JSON.stringify({ status: 'PASS', authority: 'LEAN_AGENT_EXECUTION_CONTROL_TEST', checks: 11 }, null, 2));
