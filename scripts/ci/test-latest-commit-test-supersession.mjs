import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/latest-commit-test-supersession.yml', 'utf8');

assert.match(workflow, /group:\s*flixo-latest-commit-supersession-\$\{\{\s*github\.event_name\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\|\|\s*github\.repository\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name\s*\}\}/);
assert.match(workflow, /cancel-in-progress:\s*true/);
assert.match(workflow, /uses:\s*actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/);
assert.match(workflow, /ref:\s*main/);
assert.match(workflow, /permissions:\s*\n\s*actions:\s*write/);
assert.match(workflow, /EVENT_SHA_SOURCE=IMMUTABLE_GITHUB_EVENT_SHA/);
assert.match(workflow, /git ls-remote "[^"]*refs\/heads\/\$TARGET_BRANCH"/);
assert.match(workflow, /stale_event=false/);
assert.match(workflow, /stale_event=true/);
assert.match(workflow, /if: steps\.head\.outputs\.stale_event != 'true'/);
assert.match(workflow, /gh run cancel "\$run_id" --repo "\$REPOSITORY"/);
assert.match(workflow, /STALE_RUN_ALREADY_COMPLETED run=\$run_id/);
assert.doesNotMatch(workflow, /gh run view "\$run_id"/);
assert.doesNotMatch(workflow, /gh run cancel "\$run_id" --repo "\$REPOSITORY"\s*\|\|\s*true/);
assert.match(workflow, /gh api --paginate/);
assert.doesNotMatch(workflow, /gh api --paginate --slurp/);
assert.match(workflow, /STALE_ACTIVE_RUNS=\$stale_active/);
assert.match(workflow, /queued\|pending\|in_progress/);
assert.doesNotMatch(workflow, /KEEP_STARTED_(?:RUN|STALE_RUN)/u);
assert.match(workflow, /\*Heartbeat\*/i);
assert.match(workflow, /\*Execution\*/i);
assert.match(workflow, /SUPERSESSION_LATE_STALE_ID_FILE=\/tmp\/supersession-late-stale-ids\.txt/);
assert.doesNotMatch(workflow, /done < <\(/);
assert.doesNotMatch(workflow, /\| @tsv' \/tmp\/supersession-final-runs\.json\)/);
assert.match(workflow, /done < \/tmp\/supersession-late-stale-ids\.txt/);
assert.match(workflow, /LATEST_COMMIT_ONLY_ENFORCED=true/);
assert.match(workflow, /SUPERSESSION_HEAD_MOVED old=\$EXPECTED_SHA new=\$CURRENT_SHA/);

console.log('LATEST_COMMIT_TEST_SUPERSESSION_CONTRACT=PASS');
console.log('STALE_STARTED_RUNS_CANCELLED_BY_CONTROLLER=PASS');
