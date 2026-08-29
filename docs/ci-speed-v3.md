# CI Speed V3

## Goals

Reduce wall-clock time and runner/setup overhead without removing tests, browsers, locales, or required gates.

## Invariants

- Every suite/browser pair in the full matrix remains executed.
- Every locale remains executed by both static and runtime localization checks.
- `fail-fast: false` is retained for diagnostics.
- A failed shard fails its parent gate.
- Skipped matrix members are not treated as success.
- Exact commit SHA remains part of promotion evidence.
- `main` runs are not canceled by newer pushes.

## Optimization model

- Batch repeated setup-heavy matrices into a smaller number of shards.
- Reuse npm and Playwright caches by lockfile/browser.
- Keep independent jobs parallel so unrelated failures remain visible.
- Preserve full coverage through Playwright sharding rather than reducing the suite list.
- Record CI timing and queue metrics from Actions runs before making further concurrency changes.
