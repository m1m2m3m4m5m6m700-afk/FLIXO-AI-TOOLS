# FLIXO CI Speed V4

## Purpose

Reduce wall-clock time and runner waste without reducing verification strength.

## V4 invariants

- Every required evidence surface remains a dedicated blocking job.
- Canonical Verification aggregates required job results and fails closed on anything other than `success`.
- Canonical Verification does not rerun suites already executed by required prerequisite jobs.
- Build, production audit, supply-chain, secret-history, CodeQL, contracts, browser smoke, and S3 remain independently evaluated.
- PR concurrency cancels obsolete PR runs while `main` runs remain non-cancelable.
- npm cache remains keyed by the lockfile; install commands disable duplicate audit/fund/update-notifier work.
- Browser smoke retains all five declared checks and uses Playwright cache.
- Full certification remains separate from the blocking PR pipeline.

## Why the aggregator is safe

A prerequisite job returning anything other than `success` is a hard failure. The aggregator has no success path for `skipped`, `cancelled`, or `failure` results. Therefore removing a duplicate execution from the aggregator cannot turn an unexecuted prerequisite into a pass.

## Measurement rule

Do not claim a speed improvement until Actions measurements compare wall-clock time, queue time, and runner minutes before and after V4.
