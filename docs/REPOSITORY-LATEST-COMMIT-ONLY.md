# Repository Policy — Latest-Commit-Only

Rule ID: LATEST-COMMIT-ONLY-002
Scope: repository-wide commit-driven execution and verification
Canonical branches: execution and main
Promotion direction: execution -> main

## Rule

For each canonical branch, the live branch tip is the only authoritative execution SHA.

When the branch advances:
- every active workflow run attached to an older SHA is cancelled;
- every exact-SHA verifier rejects the older SHA;
- older completed evidence becomes historical/stale and cannot certify the newer SHA.

There is no resident-workflow exception. Workflow role, watchdog status, repair role, heartbeat role, or advisory designation does not exempt an older SHA.

## Enforcement

1. .github/workflows/latest-commit-test-supersession.yml is the repository-wide active-run cancellation controller.
2. scripts/ci/assert-current-commit.mjs is mandatory fail-closed freshness enforcement for exact-SHA verification.
3. scripts/ci/test-latest-commit-only.mjs prevents regression of the latest-commit policy in the verification contract.
4. scripts/ci/latest-execution-head-cleanup.mjs removes stale historical execution state after retention.

## Race rule

Cancellation races are not a bypass. Any stale run reaching an exact-SHA gate after the branch advances fails closed.

## GitHub status limitation

A workflow run that has already completed cannot be converted retroactively to the GitHub status 'cancelled'. Such runs remain historical records, but they are not authoritative evidence and must fail current-SHA certification.

## Result

At any point in time, only the live branch tip can produce authoritative current GREEN evidence for the canonical branch.
