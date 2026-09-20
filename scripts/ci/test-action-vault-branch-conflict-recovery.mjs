#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('scripts/ci/action-vault-branch-conflict-recovery.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/auto-repair.yml','utf8');
assert.match(source,/origin','execution/);
assert.match(source,/reset','--hard',remoteSha/);
assert.match(source,/REQUALIFY_REQUIRED/);
assert.match(source,/sameMissionContinuation:true/);
assert.match(source,/oldRepairContextDiscarded:true/);
assert.match(workflow,/Recover execution branch conflict without owner withdrawal/);
assert.match(workflow,/REQUALIFY_SAME_MISSION/);
assert.match(workflow,/action-repair-dual-control\.mjs audit/);
assert.match(workflow,/auto-repair-engine\.mjs/);
assert.match(workflow,/FLIXO_CONFLICT_OWNER_WITHDRAWAL: 'false'/);
assert.match(workflow,/execution advanced again after conflict recovery/);
console.log(JSON.stringify({status:'PASS',authority:'ACTION_VAULT_BRANCH_CONFLICT_RECOVERY_TEST',assertions:10},null,2));
