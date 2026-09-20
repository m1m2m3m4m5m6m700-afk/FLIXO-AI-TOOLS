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

for (const file of files) {
  assert.ok(fs.existsSync(file), `missing workflow: ${file}`);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /concurrency:/u, `${file}: concurrency contract missing`);
  assert.match(source, /cancel-in-progress:\s*true/u, `${file}: stale run cancellation disabled`);
  assert.match(source, /github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository/u, `${file}: head repository is not part of concurrency identity`);
  assert.match(source, /github\.event\.pull_request\.head\.ref \|\| github\.ref_name/u, `${file}: head branch is not part of concurrency identity`);
  if (file !== '.github/workflows/auto-repair-merge-gate.yml') {
    assert.match(source, staleGuard, `${file}: stale exact-SHA guard missing`);
  }
}

const supersession = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml','utf8');
assert.match(supersession, /name:\s*FLIXO Latest Commit Test Supersession/u);
assert.match(supersession, /branches:\s*\n\s*- execution/u);
assert.match(supersession, /actions:\s*write/u);
assert.match(supersession, /gh run list/u);
assert.match(supersession, /CANCEL stale run=/u);
assert.match(supersession, /HEAD_SHA" = "\$CURRENT_SHA"/u);
assert.match(supersession, /LATEST_COMMIT_SUPERSESSION=PASS/u);

const ci = fs.readFileSync('.github/workflows/ci.yml','utf8');
assert.match(ci, /push:\s*\n\s*branches:\s*\[main, execution\]/u);
assert.match(ci, /group:\s*flixo-test-/u);
assert.match(ci, /cancel-in-progress:\s*true/u);

console.log('LATEST_COMMIT_ONLY_TESTS=PASS');
console.log('STALE_TEST_CANCELLATION=PASS');
console.log('EXACT_SHA_STALE_GUARD=PASS');
console.log('EXECUTION_PUSH_TEST_TRIGGER=PASS');
