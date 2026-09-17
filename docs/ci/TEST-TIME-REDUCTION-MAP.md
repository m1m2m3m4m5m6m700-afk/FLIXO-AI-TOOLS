# FLIXO CI — Test-Time Reduction Map

## Goal

Reduce feedback time as aggressively as possible **without weakening correctness, security, evidence, or the self-healing contract**.

> Fast path for feedback, full path for trust.

A test may be skipped from an early lane only when the impact planner proves it is out of scope. Canonical full verification remains mandatory at the protected merge/release boundary.

## Execution architecture

```text
Change
  |
  v
Immutable SHA + changed-file graph
  |
  +--> Unknown / high-risk change --------> FULL TRUST LANE
  |
  +--> Known low-risk change --------------> IMPACT LANE
  |                                             |
  |                                             +--> bounded parallel verification
  |                                             +--> evidence + SHA verification
  |                                             +--> failure -> Self-Healing loop
  |
  v
Canonical merge verification
  |
  +--> static/typecheck/build
  +--> browser FAST shards
  +--> browser DEEP locale shards
  +--> certification/evidence graph
  |
  v
GREEN only when every required gate is proven
```

## Phase 1 — Fast feedback

1. Reuse npm and browser dependency caches keyed by lockfile + Node version.
2. Build the impact plan from the exact PR/base SHA pair.
3. Run independent verification commands in bounded parallelism.
4. Keep installation/mutating commands serialized.
5. Never parallelize commands that share mutable output or state.
6. Preserve immutable build-artifact identity across every browser job.

## Phase 2 — Test selection

The existing `scripts/ci/test-impact.mjs` remains the selector of record. Its map is `scripts/ci/test-impact-map.json`.

- Known domain + known risk: run only the affected contract/unit/e2e commands.
- Multiple domains: union commands and de-duplicate them.
- Unknown files: force the full lane.
- Release mode: force the full lane.
- No matched domain: force the full lane.
- CI/agent/orchestration changes: treat as contract/high-risk and never rely on a reduced browser-only check.

## Phase 3 — Parallelism

Use the largest **bounded** parallelism that the runner can sustain without resource contention.

- Impact verification: maximum **12** concurrent commands.
- Browser FAST: 3 browsers × 2 shards.
- Browser DEEP: 3 browsers × 3 shards.
- Playwright workers: 6 per browser job.
- Matrix `fail-fast: false` preserves independent evidence from every shard.

The impact executor still enforces an absolute ceiling of 16; the CI policy uses 12 as the safer operating point. If CPU, memory, I/O, browser startup, or external rate limits become the bottleneck, higher concurrency can make total wall time worse.

## Phase 4 — Full trust lane

The full lane remains the merge/release authority:

- typecheck/static contracts
- production build
- immutable artifact identity
- browser dependency identity
- Browser FAST matrix
- Browser DEEP locale matrix
- certification/evidence completeness
- CI/agent protocol contracts
- self-healing diagnosis and repair proof when a gate fails

Speed optimization must never remove these gates from the canonical trust boundary.

## Phase 5 — Self-healing interaction

Any `failure`, `cancelled`, `timed_out`, `action_required`, or `stale` result is unresolved.

```text
failure
 -> capture evidence
 -> classify root cause
 -> prove diagnosis
 -> bounded repair
 -> reproduce original failure
 -> prove recovery
 -> recurrence proof
 -> typecheck/static/build
 -> canonical CI
 -> learning/prevention
 -> repeat if unresolved
```

A weak or ambiguous diagnosis must not trigger an unproven mutation. The system should fail closed and keep the repair loop open.

## Phase 6 — Evidence and measurement

Every optimization must report:

- total wall-clock duration
- queue/wait duration when available
- install/cache duration
- selected command count
- skipped command count and reason
- concurrency used
- pass/fail/cancelled counts
- SHA and artifact identity
- evidence class
- whether full verification was required

Track p50/p95 duration over time. Optimize the slowest critical path rather than merely increasing parallelism.

## Safe optimization backlog

### Tier A — implemented

- Lockfile + Node keyed npm/browser caches.
- Single immutable build artifact reused by browser jobs.
- Impact selection before expensive browser execution.
- Bounded parallel verification with mutations/installations serialized.
- Browser matrix parallelism.
- Full verification retained for the canonical trust boundary.
- Impact concurrency raised from 10 to 12 with an explicit evidence assertion.

### Tier B — next optimization cycle

- Split large contract suites into independent shards.
- Add duration-aware shard balancing instead of equal-count shards.
- Cache stable generated assets where identity can be cryptographically verified.
- Avoid repeated repository-wide discovery in individual jobs.
- Precompute the changed-file impact graph once and pass it as immutable evidence.

### Tier C — advanced

- Historical duration model for shard balancing.
- Critical-path scheduler using measured job durations.
- Automatic concurrency tuning within hard safety limits.
- Quarantine only tests with explicit, machine-verifiable quarantine policy; never silently ignore failures.

## Non-negotiable safety rules

1. Never convert a failure to success because a test was skipped.
2. Never let cancellation count as proof.
3. Never weaken the canonical merge gate to improve timing.
4. Never share mutable test output between parallel jobs without isolation.
5. Never allow an unknown change to use the reduced lane.
6. Never allow a weak root-cause diagnosis to mutate code automatically.
7. Every verified repair must pass regression and canonical CI.
8. A GREEN state requires complete required evidence, not merely a successful final command.

## Success criterion

The optimization is successful only when **time decreases while the set of trust guarantees stays unchanged**.

Target outcome: shorter PR feedback, unchanged merge confidence, and a self-healing loop that spends its time repairing real failures instead of repeatedly rebuilding unaffected work.
