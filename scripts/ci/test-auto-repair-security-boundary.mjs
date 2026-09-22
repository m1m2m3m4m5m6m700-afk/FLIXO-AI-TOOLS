import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const worker = fs.readFileSync('scripts/ci/action-repair-five-workers.mjs', 'utf8');

assert.doesNotMatch(workflow, /needs:\s*adversarial_twin/);
assert.doesNotMatch(workflow, /needs\.adversarial_twin\.outputs/);
assert.doesNotMatch(workflow, /--historical="\$\{FLIXO_HISTORICAL_SOLUTION_PATH/);
assert.doesNotMatch(workflow, /--twin-a="\$\{FLIXO_TWIN_A_PATH/);
assert.doesNotMatch(workflow, /--twin-b="\$\{FLIXO_TWIN_B_PATH/);
assert.doesNotMatch(workflow, /FLIXO_SELECTED_REPAIR_STRATEGY=.*>> "\$GITHUB_ENV"/);
assert.doesNotMatch(workflow, /FLIXO_REPAIR_ACTOR=.*>> "\$GITHUB_ENV"/);
assert.doesNotMatch(workflow, /FLIXO_ACTIVE_ACTION_BROTHER=.*>> "\$GITHUB_ENV"/);
assert.match(workflow, /FLIXO_HISTORICAL_SOLUTION_PATH: \/tmp\/flixo-historical-solution-index\.json/);
assert.match(workflow, /FLIXO_TWIN_A_PATH: \/tmp\/flixo-twin-a\.json/);
assert.match(workflow, /FLIXO_TWIN_B_PATH: \/tmp\/flixo-twin-b\.json/);
assert.match(workflow, /FLIXO_SELECTION_PATH: \/tmp\/flixo-selected-repair-option\.json/);
assert.match(workflow, /validate-adversarial-repair-twin\.mjs/);
assert.match(workflow, /test-auto-repair-security-boundary\.mjs/);
assert.match(worker, /role==='select'/);
assert.match(worker, /canonicalMutationOwner:'repairAgent'/);

console.log('AUTO_REPAIR_SECURITY_BOUNDARY=PASS');
const boundary = fs.readFileSync('scripts/ci/validate-auto-repair-boundary.mjs', 'utf8');
assert.match(boundary, /required-evidence-workflow-must-cancel-stale/u);
assert.doesNotMatch(boundary, /required-evidence-workflow-must-not-cancel/u);
assert.match(workflow, /contents:\s*read/u);
assert.match(workflow, /actions:\s*read/u);
assert.match(workflow, /checks:\s*read/u);
assert.doesNotMatch(workflow, /(?:pull-requests|issues|statuses|security-events):\s*write/u);
assert.match(workflow, /git worktree add --detach \"\$TARGET_ROOT\" \"\$EXECUTION_SHA\"/u);
assert.doesNotMatch(workflow, /git\\s+(?:switch|checkout)\\s+-c\\s+execution/u);
assert.match(workflow, /FLIXO_DETACHED_EXECUTION_TARGET=true/u);
assert.doesNotMatch(workflow, /actions:\s*write/u);
console.log('AUTO_REPAIR_TEST_ORCHESTRATION_REPAIR_PERMISSION=PASS');
