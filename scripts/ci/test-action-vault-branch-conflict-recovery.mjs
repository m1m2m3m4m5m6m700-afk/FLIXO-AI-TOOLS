#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('scripts/ci/action-vault-branch-conflict-recovery.mjs','utf8');
assert.match(source,/git.*fetch/);
assert.match(source,/origin','execution/);
assert.match(source,/git.*reset.*--hard/);
assert.match(source,/git.*apply.*--3way/);
assert.match(source,/REPAIR_REGENERATE_REQUIRED/);
assert.match(source,/KEEP_SAME_MISSION_REGENERATE_REPAIR_ON_CURRENT_SHA/);
assert.match(source,/REVERIFY_ON_CURRENT_SHA/);
console.log(JSON.stringify({status:'PASS',authority:'ACTION_VAULT_BRANCH_CONFLICT_RECOVERY_TEST',assertions:7},null,2));
