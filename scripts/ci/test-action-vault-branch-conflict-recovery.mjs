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
assert.match(workflow,/Enforce exact failed SHA before diagnosis/);
assert.match(workflow,/EXACT_FAILED_SHA_REQUALIFICATION=PASS/);
assert.doesNotMatch(workflow,/REQUALIFY_SAME_MISSION/);
assert.match(workflow,/execution head moved after failure; refusing stale repair retargeting/);
assert.match(workflow,/new repair cycle must be opened for the new SHA/);
assert.match(workflow,/Bind working tree to the failed SHA|exact failed execution SHA/);
console.log(JSON.stringify({status:'PASS',authority:'ACTION_VAULT_BRANCH_CONFLICT_RECOVERY_TEST',assertions:10},null,2));