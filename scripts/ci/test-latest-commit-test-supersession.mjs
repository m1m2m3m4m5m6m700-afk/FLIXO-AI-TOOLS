import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');

assert.match(workflow, /cancel_stale_run\(\)/);
assert.match(workflow, /if ! gh run cancel "\$run_id" --repo "\$REPOSITORY"/);
assert.match(workflow, /if ! now_status="\$\(gh run view "\$run_id" --repo "\$REPOSITORY" --json status --jq '\\.status'\)"/);
assert.match(workflow, /STALE_RUN_ALREADY_COMPLETED run=\$run_id/);
assert.match(workflow, /ERROR: cancellation failed for active run=\$run_id status=\$now_status/);
assert.doesNotMatch(workflow, /gh run cancel "\$run_id" --repo "\$REPOSITORY"\s*\|\|\s*true/);

console.log('LATEST_COMMIT_TEST_SUPERSESSION_RACE_REGRESSION=PASS');
