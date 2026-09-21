import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');

assert.match(workflow, /cancel_stale_run\(\)/);
assert.match(workflow, /group:\s*flixo-latest-commit-supersession-(?:\$\{\{\s*github\.event_name\s*\}\}-)?\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\|\|\s*github\.repository\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name\s*\}\}/);
assert.match(workflow, /if ! gh run cancel "\$run_id" --repo "\$REPOSITORY"/);
assert.match(workflow, /if ! now_status="\$\(gh run view "\$run_id" --repo "\$REPOSITORY" --json status --jq '\.status'\)"/);
assert.match(workflow, /STALE_RUN_ALREADY_COMPLETED run=\$run_id/);
assert.match(workflow, /ERROR: cancellation failed for active run=\$run_id status=\$now_status/);
assert.doesNotMatch(workflow, /gh run cancel "\$run_id" --repo "\$REPOSITORY"\s*\|\|\s*true/);

console.log('LATEST_COMMIT_TEST_SUPERSESSION_RACE_REGRESSION=PASS');

assert.match(workflow, /gh api "repos\/\$GITHUB_REPOSITORY\/git\/ref\/heads\/\$BRANCH" --jq '\.object\.sha'/);
assert.match(workflow, /stale_event=false/);
assert.match(workflow, /stale_event=true/);
assert.match(workflow, /if: steps\.head\.outputs\.stale_event != 'true'/);
assert.match(workflow, /if \[ "\$LIVE_SHA" != "\$CURRENT_SHA" \]; then/);
assert.match(workflow, /SUPERSESSION_ABORTED_HEAD_MOVEMENT/);
assert.match(workflow, /if: steps\.head\.outputs\.stale_event != 'true' && steps\.cancel\.outputs\.obsolete != 'true'/);
assert.match(workflow, /SUPERSESSION_HEAD_MOVED/);
