#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredWorkflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/test-impact.yml',
  '.github/workflows/test-impact-execution.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  '.github/workflows/advanced-repair-contract.yml',
  '.github/workflows/repository-security-baseline.yml',
  '.github/workflows/claude-security-review.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
];

for (const file of requiredWorkflows) {
  assert.ok(fs.existsSync(file), 'missing workflow: ' + file);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /concurrency:/u, file + ': concurrency contract missing');
  const workflowRunConsumer = /^(?:.*\n)*\s*workflow_run\s*:/m.test(source);
  if (workflowRunConsumer) {
    assert.match(source, /scripts\/ci\/assert-workflow-run-current\.mjs/u, file + ': workflow_run consumer must bind current source SHA');
  } else if (/^(?:.*\n)*\s*(?:push|pull_request)\s*:/m.test(source)) {
    const hasExplicitExactShaGuard = /scripts\/ci\/assert-current-commit\.mjs/u.test(source) || /Bind exact execution head/u.test(source) || /HEARTBEAT_EXACT_SHA=/u.test(source) || (/EXPECTED_SHA/u.test(source) && /Checkout exact SHA/u.test(source) && /Validate exact SHA format/u.test(source));
    assert.equal(hasExplicitExactShaGuard, true, file + ': commit-driven workflow must have a fail-closed exact-SHA guard');
    assert.match(source, /(?:github\.event\.pull_request\.head\.sha \|\| github\.sha|EXPECTED_SHA)/u, file + ': exact SHA binding missing');
    if (/^\s*pull_request(?:\s*:|\s*$)/mu.test(source)) {
      assert.match(source, /github\.event\.pull_request\.head\.(?:repo\.full_name|ref)/u, file + ': PR source identity binding missing');
    }
  }
}

const controller = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');
assert.match(controller, /actions:\s*write/u);
assert.match(controller, /Cancel every active run for an older SHA/u);
assert.match(controller, /gh api --paginate/u);
assert.match(controller, /head_sha != \$sha/u);
assert.match(controller, /STALE_RUN_CANCELLED/u);
assert.match(controller, /LATEST_COMMIT_ONLY_ENFORCED=true/u);
assert.doesNotMatch(controller, /is_resident_protected_run/u);
assert.doesNotMatch(controller, /KEEP_STARTED_STALE_RUN/u);

const currentCommitGuard = fs.readFileSync('scripts/ci/assert-current-commit.mjs', 'utf8');
assert.match(currentCommitGuard, /actualSha !== expectedSha/u);
assert.match(currentCommitGuard, /FAIL CLOSED/u);
assert.doesNotMatch(currentCommitGuard, /CURRENTNESS_DECISION=DELEGATED_TO_SUPERSESSION_GATE/u);
assert.doesNotMatch(currentCommitGuard, /requireLiveHeadMatch/u);

const workflowDir = '.github/workflows';
const currentWorkflows = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/u.test(file)).sort();
const commitDrivenName = /(?:test|verification|contract|security|baseline|certification|impact|codeql|code scanning|diagnostic|proof|scan|repair)/iu;

for (const file of currentWorkflows) {
  if (file === 'latest-commit-test-supersession.yml') continue;
  const source = fs.readFileSync(workflowDir + '/' + file, 'utf8');
  const nameMatch = source.match(/^name:\s*(.+)$/m);
  const workflowName = nameMatch?.[1]?.trim() ?? file;
  if (!commitDrivenName.test(workflowName)) continue;
  assert.match(source, /concurrency:/u, file + ': latest-commit workflow must define concurrency');
  const hasWorkflowRunTrigger = /^\s{2}workflow_run\s*:/mu.test(source);
  const hasPushTrigger = /^\s{2}push\s*:/mu.test(source);
  const hasPullRequestTrigger = /^\s{2}pull_request\s*:/mu.test(source);
  if (hasWorkflowRunTrigger) {
    assert.match(source, /scripts\/ci\/assert-workflow-run-current\.mjs/u, file + ': workflow_run consumer must bind current source SHA');
  } else if (hasPushTrigger || hasPullRequestTrigger) {
    assert.match(source, /scripts\/ci\/assert-current-commit\.mjs/u, file + ': commit-driven workflow must have fail-closed exact-SHA guard');
    assert.match(source, /(?:github\.event\.pull_request\.head\.sha \|\| github\.sha|EXPECTED_SHA)/u, file + ': exact SHA binding missing');
    if (hasPullRequestTrigger) {
      assert.match(source, /github\.event\.pull_request\.head\.(?:repo\.full_name|ref)/u, file + ': PR source identity binding missing');
    }
  }
}

for (const file of currentWorkflows) {
  const source = fs.readFileSync(workflowDir + '/' + file, 'utf8');
  if (!/^\s{2}workflow_run\s*:/mu.test(source)) continue;
  assert.match(source, /scripts\/ci\/assert-workflow-run-current\.mjs/u, file + ': workflow_run consumer must enforce the live source SHA');
  assert.match(
    source,
    /actions:\s*write/u,
    file + ': stale workflow_run consumer must be able to cancel itself fail-closed',
  );
}

console.log('LATEST_COMMIT_ONLY_TESTS=PASS');
console.log('ALL_ACTIVE_STALE_RUNS_CANCELLED=PASS');
console.log('EXACT_SHA_STALE_GUARD_MANDATORY=PASS');
console.log('REPOSITORY_LATEST_COMMIT_POLICY=PASS');
