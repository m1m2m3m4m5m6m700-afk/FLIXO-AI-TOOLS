#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  '.github/workflows/ci.yml',
  '.github/workflows/test-impact.yml',
  '.github/workflows/test-impact-execution.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  '.github/workflows/advanced-repair-contract.yml',
  '.github/workflows/repository-security-baseline.yml',
  '.github/workflows/claude-security-review.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
];
const staleGuard = /Fail closed when this commit is superseded[\s\S]*?run: node scripts\/ci\/assert-current-commit\.mjs/u;
const nonCancellingEvidenceFiles = new Set();

for (const file of files) {
  assert.ok(fs.existsSync(file), `missing workflow: ${file}`);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /concurrency:/u, `${file}: concurrency contract missing`);
  if (nonCancellingEvidenceFiles.has(file)) {
    assert.match(source, /cancel-in-progress:\s*false/u, file + ': non-cancelling evidence workflow must preserve started runs');
  } else {
    assert.match(source, /cancel-in-progress:\s*true/u, file + ': required verification workflow must cancel stale runs');
  }
  assert.match(source, /github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository/u, `${file}: head repository is not part of concurrency identity`);
  assert.match(source, /github\.event\.pull_request\.head\.ref \|\| github\.ref_name/u, file + ': head branch is not part of concurrency identity');
  assert.match(source, /github\.event\.pull_request\.head\.sha \|\| github\.sha/u, file + ': exact head SHA is not part of concurrency identity');
  if (file !== '.github/workflows/auto-repair-merge-gate.yml') {
    assert.match(source, staleGuard, `${file}: stale exact-SHA guard missing`);
  }
}

const supersession = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml','utf8');
assert.match(supersession, /name:\s*FLIXO Latest Commit Test Supersession/u);
assert.match(supersession, /branches:\s*\n\s*- execution/u);
assert.match(supersession, /actions:\s*write/u);
assert.match(supersession, /actions\/runs\?branch=\$BRANCH&per_page=100/u);
assert.match(supersession, /TARGET_BRANCH: \$\{\{ github\.event\.pull_request\.head\.ref \|\| github\.ref_name \}\}/u);
assert.match(supersession, /SOURCE_REPOSITORY: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository \}\}/u);
assert.match(supersession, /git ls-remote.*refs\/heads\/\$TARGET_BRANCH/u);
assert.match(supersession, /gh api "repos\/\$REPOSITORY\/actions\/runs\?branch=\$BRANCH&per_page=100"/u);
assert.match(supersession, /is_supersedable_run\(\)/u);
assert.match(supersession, /head_repository\.full_name == \$sourceRepo/u);
assert.match(supersession, /CANCEL_STALE_RUN/u);
assert.match(supersession, /\.status == "queued" or \.status == "pending" or \.status == "in_progress"/u);
assert.doesNotMatch(supersession, /KEEP_STARTED_STALE_RUN/u);
assert.match(supersession, /\*Heartbeat\*/iu);
assert.match(supersession, /\*Execution\*/iu);
assert.match(supersession, /LATEST_COMMIT_SUPERSESSION=PASS/u);
assert.match(supersession, /SUPERSESSION_EXTERNAL_BLOCKER=GITHUB_ACTIONS_API_RATE_LIMIT/u);
assert.match(supersession, /BLOCKED_EXTERNAL: GitHub Actions API rate limit/u);

const watchdog = fs.readFileSync('.github/workflows/execution-bot-watchdog.yml','utf8');
assert.match(watchdog, /group:\s*flixo-execution-watchdog-\$\{\{\s*github\.ref_name\s*\}\}/u);
assert.match(watchdog, /cancel-in-progress:\s*true/u);
const greenGate = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml','utf8');

assert.match(greenGate, /cancel-in-progress:\s*true/u);

const ci = fs.readFileSync('.github/workflows/ci.yml','utf8');
assert.match(ci, /push:\s*\n\s*branches:\s*\[main, execution\]/u);
assert.match(ci, /group:\s*flixo-test-/u);
assert.match(ci, /group:\s*flixo-test-\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\|\|\s*github\.repository\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name\s*\}\}/u);
assert.match(ci, /cancel-in-progress:\s*true/u);

const workflowDir = '.github/workflows';
const currentWorkflows = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/u.test(file)).sort();
const latestOnlyName = /(?:test|verification|contract|security|baseline|certification|impact|codeql|code scanning|diagnostic|proof|scan)/iu;

for (const file of currentWorkflows) {
  if (file === 'latest-commit-test-supersession.yml') continue;
  const source = fs.readFileSync(`${workflowDir}/${file}`, 'utf8');
  const nameMatch = source.match(/^name:\s*(.+)$/m);
  const workflowName = nameMatch?.[1]?.trim() ?? file;
  if (!latestOnlyName.test(workflowName)) continue;
  assert.match(source, /concurrency:/u, `${file}: latest-only workflow must define concurrency`);
  if (nonCancellingEvidenceFiles.has('.github/workflows/' + file)) {
    assert.match(source, /cancel-in-progress:\s*false/u, file + ': non-cancelling evidence workflow must retain started runs');
  } else {
    assert.match(source, /cancel-in-progress:\s*true/u, file + ': latest-only workflow must cancel superseded runs');
  }
  assert.match(source, /github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository/u, `${file}: PR head repository missing from concurrency identity`);
  assert.match(source, /github\.event\.pull_request\.head\.ref \|\| github\.ref_name/u, file + ': PR head branch missing from concurrency identity');
  assert.match(source, /github\.event\.pull_request\.head\.ref \|\| github\.ref_name/u, file + ': canonical source branch missing from concurrency identity');
  assert.match(source, /scripts\/ci\/assert-current-commit\.mjs/u, `${file}: exact-SHA freshness guard missing`);
}

console.log('LATEST_COMMIT_ONLY_TESTS=PASS');
console.log('STALE_TEST_CANCELLATION=PASS');
console.log('EXACT_SHA_STALE_GUARD=PASS');
console.log('EXECUTION_PUSH_TEST_TRIGGER=PASS');
console.log('STALE_STARTED_TEST_RUNS_CANCELLED=PASS');

const cleanupWorkflow = fs.readFileSync('.github/workflows/latest-execution-head-cleanup.yml', 'utf8');
assert.match(cleanupWorkflow, /name:\s*FLIXO Latest Execution HEAD Cleanup/u);
assert.match(cleanupWorkflow, /schedule:/u);
assert.match(cleanupWorkflow, /cron:\s*'\*\/5 \* \* \* \*'/u);
assert.match(cleanupWorkflow, /actions:\s*write/u);
assert.match(cleanupWorkflow, /ref:\s*main/u);
assert.match(cleanupWorkflow, /latest-execution-head-cleanup\.mjs/u);
assert.match(cleanupWorkflow, /FLIXO_STALE_EXECUTION_GRACE_DAYS:\s*'14'/u);
const cleanupScript = fs.readFileSync('scripts/ci/latest-execution-head-cleanup.mjs', 'utf8');
assert.match(cleanupScript, /branch = 'execution'/u);
assert.match(cleanupScript, /headSha === latestSha/u);
assert.match(cleanupScript, /actions\/runs\/.*DELETE/u);
assert.match(cleanupScript, /actions\/artifacts\/.*DELETE/u);
assert.match(cleanupScript, /execution advanced during cleanup/u);
assert.match(cleanupScript, /LATEST_EXECUTION_HEAD_ONLY_CLEANUP=PASS/u);
const latestHeadPolicy = fs.readFileSync('docs/REPOSITORY-LATEST-EXECUTION-HEAD-ONLY.md', 'utf8');
assert.match(latestHeadPolicy, /LATEST-EXECUTION-HEAD-ONLY-001/u);
assert.match(latestHeadPolicy, /Completed workflow runs and CI artifacts.*14 days/u);
assert.match(latestHeadPolicy, /never deletes.*main/isu);
console.log('LATEST_EXECUTION_HEAD_PERIODIC_CLEANUP=PASS');