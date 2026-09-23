# Repository Policy — Latest-Execution-HEAD-Only

**Rule ID:** `LATEST-EXECUTION-HEAD-ONLY-001`  
**Scope:** repository-wide  
**Canonical repair branch:** `execution`  
**Canonical promotion direction:** `execution → main`

## Rule

The live `execution` branch tip is the only authoritative current execution HEAD.

Any workflow run, verification invocation, deployment evidence, or generated CI artifact tied to an older `execution` SHA becomes **STALE** as soon as the branch advances. Historical evidence may describe its original run, but it must never certify the newer HEAD.

## Enforcement

1. `.github/workflows/latest-commit-test-supersession.yml` cancels active stale verification runs.
2. `scripts/ci/assert-current-commit.mjs` fail-closes jobs that require the live-head match.
3. `scripts/ci/latest-execution-head-cleanup.mjs` performs periodic retention cleanup.
4. `.github/workflows/latest-execution-head-cleanup.yml` runs the cleanup weekly and is sourced from trusted `main`.

## Periodic deletion

Completed workflow runs and CI artifacts for older `execution` SHAs are deleted after **14 days**.

Active stale runs are cancelled during cleanup. The cleanup never deletes:

- the current `execution` HEAD or anything attached to it;
- `main` runs or artifacts;
- tracked repository files, task ledgers, memory, or learning records;
- runs/artifacts belonging to another repository.

## Race safety

The cleanup resolves the live `execution` SHA before deletion and re-checks it after deletion. If the branch moves during cleanup, the job fails closed.

This rule removes obsolete operational CI state over time without rewriting the repository's tracked historical record.
