# FLIXO CI Speed Policy

## Objective
Minimize wall-clock time and runner waste without reducing verification strength.

## Rules
- Required verification is never deleted to make CI faster.
- `SKIP`, missing execution, or unavailable evidence is not a pass.
- Independent failure visibility uses `fail-fast: false` where diagnosis matters.
- Parallelism is bounded by actual account capacity; a high matrix ceiling does not guarantee simultaneous runners.
- Expensive duplicate workflows are not run on every PR when an equivalent required pre-merge gate already proves the same surface.
- Full certification remains mandatory on `main`/release paths even when it is not duplicated on every PR.
- Diagnostic workflows are opt-in unless they provide unique required evidence.
- Matrix entries are explicit and must not accidentally create a Cartesian product.
- Shards must execute a deterministic, complete subset of the declared matrix.
- Any shard failure fails its aggregate gate.
- Any unexpected test-count drift fails the gate.

## Current topology
- CI: fast blocking typecheck/lint/build/security/contract checks and canonical aggregation.
- S4 Runtime + E2E: blocking pre-merge browser/runtime proof across Chromium, Firefox, and WebKit.
- Localization 20: 10 parallel shards, two locales per shard; each locale executes both static and runtime validation.
- Full Matrix Promotion: 12 shards on `main`/release and scheduled certification; 23 suites × 3 browsers remain covered.
- Root Cause Diagnostics: manual/main diagnostic microscope; it does not compete with the blocking PR pipeline.
- Parallel Diagnostics: manual/main diagnostic matrix; it does not compete with the blocking PR pipeline.

## Anti-regression checks
- Every optimized matrix has explicit cardinality assertions or explicit entry mapping.
- Every aggregate records the number of executed cases and fails closed on missing cases.
- Exact commit SHA is retained for promotion evidence.
