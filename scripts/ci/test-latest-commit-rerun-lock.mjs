#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const supersession = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');
const createIdentity = fs.readFileSync('scripts/ci/create-run-identity.mjs', 'utf8');
const verifyLock = fs.readFileSync('scripts/ci/verify-run-lock.mjs', 'utf8');

assert.match(ci, /github\.run_attempt\s*>\s*1/u);
assert.match(ci, /flixo-test-rerun-\{0\}/u);
assert.match(ci, /cancel-in-progress:\s*true/u);
assert.match(ci, /REQUIRE_LIVE_HEAD_MATCH:\s*['"]true['"]/u);
assert.match(ci, /verify-run-lock\.mjs/u);

assert.match(supersession, /gh api --paginate --slurp/u);
assert.match(supersession, /CANCEL_STALE_RUN/u);
assert.doesNotMatch(supersession, /KEEP_IN_PROGRESS_STALE/u);
assert.match(supersession, /Repair/u);
assert.match(supersession, /actions\/runs\?branch=\$BRANCH/u);

assert.match(createIdentity, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(createIdentity, /testDefinitionSha256/u);
assert.match(createIdentity, /playwright\.config\.ts/u);
assert.match(createIdentity, /runId:/u);
assert.match(createIdentity, /runAttempt:/u);
assert.match(verifyLock, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(verifyLock, /Test definition changed during run/u);

console.log('LATEST_COMMIT_ONLY=PASS');
console.log('STALE_RUN_CANCELLATION=PASS');
console.log('RERUN_LOCK=PASS');
console.log('TEST_DEFINITION_LOCK=PASS');
