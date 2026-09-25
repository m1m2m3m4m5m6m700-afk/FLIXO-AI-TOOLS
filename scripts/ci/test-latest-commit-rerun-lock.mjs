#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const supersession = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');
const createIdentity = fs.readFileSync('scripts/ci/create-run-identity.mjs', 'utf8');
const verifyLock = fs.readFileSync('scripts/ci/verify-run-lock.mjs', 'utf8');
const createProof = fs.readFileSync('scripts/ci/create-run-proof.mjs', 'utf8');
const verifyProof = fs.readFileSync('scripts/ci/verify-run-proof.mjs', 'utf8');

assert.match(ci, /github\.run_attempt\s*>\s*1/u);
assert.match(ci, /group:\s*flixo-test-\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\|\|\s*github\.repository\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name\s*\}\}/u);
assert.match(ci, /EXPECTED_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/u);
assert.match(ci, /cancel-in-progress:\s*false/u);
assert.match(ci, /REQUIRE_LIVE_HEAD_MATCH:\s*['"]true['"]/u);
assert.match(ci, /verify-run-lock\.mjs/u);
assert.match(ci, /create-run-proof\.mjs/u);
assert.match(ci, /verify-run-proof\.mjs/u);

const verifyStart = ci.indexOf('  verify:\n');
const browserFastStart = ci.indexOf('  browser_fast:\n');
const browserDeepStart = ci.indexOf('  browser_deep:\n');
if (verifyStart < 0 || browserFastStart <= verifyStart || browserDeepStart <= browserFastStart) throw new Error('BROWSER_SECTIONS_NOT_FOUND');
const verifySection = ci.slice(verifyStart, browserFastStart);
const browserFast = ci.slice(browserFastStart, browserDeepStart);
const browserDeep = ci.slice(browserDeepStart);
assert.match(verifySection, /name:\s*Propagate immutable run identity into browser build artifact[\s\S]*dist\/diagnostics\/certification\/run-identity\.json/u);
assert.match(verifySection, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*dist\//u);
assert.match(browserFast, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*dist/u);
assert.doesNotMatch(browserFast, /flixo-static-build-evidence-\$\{\{\s*github\.run_id\s*\}\}/u);
assert.match(browserFast, /name:\s*Verify immutable rerun lock[\s\S]*FLIXO_RUN_IDENTITY_PATH:\s*dist\/diagnostics\/certification\/run-identity\.json/u);
assert.match(browserDeep, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*dist/u);

assert.ok(supersession.includes('gh api --paginate'), 'Supersession must paginate all runs');
assert.equal(supersession.includes('gh api --paginate --slurp'), false);
assert.equal(supersession.includes('--slurp\\b'), false);
assert.ok(supersession.includes('git ls-remote "https://github.com/$SOURCE_REPOSITORY.git" "refs/heads/$TARGET_BRANCH"'));
assert.equal(supersession.includes('gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER"'), false);
assert.ok(supersession.includes('cancel_run()'));
assert.ok(supersession.includes('case "$status" in queued|pending|in_progress)'));
assert.ok(supersession.includes('select((.status == "queued" or .status == "pending" or .status == "in_progress"))'));
assert.ok(supersession.includes('select(.head_sha != $sha)') || supersession.includes('select(.head_sha != $CURRENT_SHA)'));
assert.ok(supersession.includes('.head_repository.full_name'));
assert.ok(supersession.includes('EVENT_SHA_SOURCE=IMMUTABLE_GITHUB_EVENT_SHA'));
assert.ok(supersession.includes('STALE_ACTIVE_RUNS=$stale_active'));
assert.ok(supersession.includes('LATEST_COMMIT_ONLY_ENFORCED=true'));
assert.ok(supersession.includes('SUPERSESSION_HEAD_MOVED old=$CURRENT_SHA new=$LIVE_SHA'));
assert.ok(supersession.includes('LATE_STALE_RUN_CANCEL_REQUESTED'));
assert.ok(supersession.includes('CANCEL_DEFERRED_STALE_INVALIDATED id=$run_id reason=rate_limit'));
assert.ok(supersession.includes('STALE_RUN_INVALIDATED=true'));
assert.ok(supersession.includes('return 0'));
assert.ok(supersession.includes('reason=rate_limit_late'));
assert.equal(supersession.includes('gh run view "$run_id"'), false);
assert.ok(supersession.includes('group: flixo-latest-commit-supersession-${{ github.event_name }}-'));
assert.match(createIdentity, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(createIdentity, /testDefinitionSha256/u);
assert.match(createIdentity, /playwright\.config\.ts/u);
assert.match(createIdentity, /scripts\/ci\/verify-run-lock\.mjs/u);
assert.match(createIdentity, /runId:/u);
assert.match(createIdentity, /runAttempt:/u);
assert.match(verifyLock, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(verifyLock, /FLIXO_RUN_IDENTITY_PATH/u);
assert.match(verifyLock, /scripts\/ci\/verify-run-lock\.mjs/u);
assert.match(createProof, /FLIXO-LATEST-COMMIT-RUN-PROOF-v1/u);
assert.match(createProof, /runAttempt/u);
assert.match(verifyProof, /RUN_PROOF_ARTIFACT_HASH_MISSING/u);
assert.match(verifyProof, /RUN_PROOF_TEST_DEFINITION_MISMATCH/u);
assert.match(verifyProof, /scripts\/ci\/verify-run-lock\.mjs/u);

console.log('LATEST_COMMIT_ONLY=PASS');
console.log('STALE_RUN_CANCELLATION=PASS');
console.log('STALE_STARTED_RUN_CANCELLATION=PASS');
console.log('RERUN_LOCK=PASS');
console.log('TEST_DEFINITION_LOCK=PASS');

assert.ok(supersession.includes('stale_active='), 'Stale active-run accounting missing');
assert.ok(supersession.includes('.status == "queued" or .status == "pending" or .status == "in_progress"'), 'Active status filter missing');
assert.ok(supersession.includes('.head_sha != $sha'), 'Stale SHA filter missing');