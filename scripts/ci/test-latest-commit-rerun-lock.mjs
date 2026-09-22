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
assert.match(ci, /group:\s*flixo-test-\$\{\{\s*github\.event_name\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/u);
assert.match(ci, /cancel-in-progress:\s*true/u);
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
assert.match(verifySection, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*\|\n\s*dist\/\n\s*diagnostics\/certification\/run-identity\.json/u);
assert.match(browserFast, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*\./u);
assert.doesNotMatch(browserFast, /flixo-static-build-evidence-\$\{\{\s*github\.run_id\s*\}\}/u);
assert.match(browserFast, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*\.[\s\S]*Verify immutable rerun lock/u);
assert.match(browserDeep, /name:\s*flixo-build-\$\{\{\s*github\.run_id\s*\}\}[\s\S]*path:\s*\./u);

assert.doesNotMatch(supersession, /gh api --paginate --slurp/u);
assert.doesNotMatch(supersession, /--paginate\b/u);
assert.doesNotMatch(supersession, /--slurp\b/u);
assert.match(supersession, /git ls-remote.*refs\/heads\/\$TARGET_BRANCH/u);
assert.doesNotMatch(supersession, /gh api "repos\/\$GITHUB_REPOSITORY\/pulls\/\$PR_NUMBER"/u);
assert.match(supersession, /CANCEL_STALE_RUN/u);
assert.doesNotMatch(supersession, new RegExp(['gh','run','view','$run_id','--repo','$REPOSITORY','--json','status'].join(' ')));
assert.match(supersession, /head_repository\.full_name/u);
assert.match(ci, /github\.run_attempt\s*>\s*1[\s\S]*format\('-rerun-\{0\}',\s*github\.run_id\)/u);
assert.match(supersession, /actions\/runs\?branch=\$BRANCH/u);
assert.match(supersession, /group:\s*flixo-latest-commit-supersession-\$\{\{\s*github\.event_name\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\|\|\s*github\.repository\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name\s*\}\}/u);
assert.doesNotMatch(supersession, /gh\s+run\s+view\s+"\$run_id"/u);
assert.match(supersession, /SOURCE_REPOSITORY:\s*\$\{\{\s*steps\.head\.outputs\.source_repository\s*\}\}/u);
assert.match(supersession, /LATEST_COMMIT_ONLY_ENFORCED=true/u);
assert.match(supersession, /\*Repair\*/u);

assert.match(createIdentity, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(createIdentity, /testDefinitionSha256/u);
assert.match(createIdentity, /playwright\.config\.ts/u);
assert.match(createIdentity, /runId:/u);
assert.match(createIdentity, /runAttempt:/u);
assert.match(verifyLock, /LATEST_COMMIT_ONLY_RERUN_LOCK_V2/u);
assert.match(verifyLock, /Test definition changed during run/u);
assert.match(createProof, /FLIXO-LATEST-COMMIT-RUN-PROOF-v1/u);
assert.match(createProof, /runAttempt/u);
assert.match(verifyProof, /RUN_PROOF_ARTIFACT_HASH_MISSING/u);
assert.match(verifyProof, /RUN_PROOF_TEST_DEFINITION_MISMATCH/u);

console.log('LATEST_COMMIT_ONLY=PASS');
console.log('STALE_RUN_CANCELLATION=PASS');
console.log('RERUN_LOCK=PASS');
console.log('TEST_DEFINITION_LOCK=PASS');
