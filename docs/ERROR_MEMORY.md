**Prevention:** Any catch-and-wrap boundary that converts an existing exception into a new `Error` must preserve the original exception as `cause`; the canonical static gate remains the regression detector.  

## F-009 — Certification Evidence Cancellation Race

**Area:** CI / Certification concurrency  
**First observed:** Repeated certification attempts in the Action Vault hardening cycle, including runs #35538555519, #35538555524, #35538555526, and #35538555532.  
**Symptom:** Required verification runs were cancelled while the execution SHA remained unchanged, leaving no completed exact-SHA evidence.  
**Root cause:** Required certification workflows used `cancel-in-progress: true` with concurrency groups scoped to the PR/branch rather than the exact head SHA. Duplicate/manual/workflow-triggered runs could cancel an otherwise valid verification run, while disabling cancellation without changing the group would serialize different SHAs behind stale runs.  
**Evidence:** The repository showed repeated cancellations on an unchanged HEAD; the required workflows all used PR/branch-scoped groups and `cancel-in-progress: true`.  
**Fix:** Required evidence workflows now use `cancel-in-progress: false` and bind their concurrency groups to the exact pull-request head SHA expression. The auto-repair boundary validator now enforces both invariants.  
**Prevention:** Required exact-SHA evidence must never be cancelled or blocked by evidence for a different SHA. Stale evidence is rejected by exact-SHA gates, not by cancelling the producer run.  
## F-010 — Verified Repair Second-Commit Drift

**Area:** Auto-Repair / exact-SHA certification
**First observed:** Auto-Repair workflow contract inspection during the Action Vault hardening cycle.
**Symptom:** A verified repair was published to `execution`, then a later step created and pushed a second learning commit on the same repair chain.
**Root cause:** `.github/workflows/auto-repair.yml` explicitly created `SECOND_SHA` and pushed a second execution commit after the verified repair commit. This violated the repair protocol's one-commit-per-completed-session boundary and could invalidate exact-SHA certification immediately after the first repair was verified.
**Evidence:** The workflow asserted `ACTION_REPAIR_TWO_COMMITS=PASS`, required two commits between the failed SHA and the final execution SHA, and then pushed `SECOND_SHA`.
**Fix:** Replaced the second commit/push step with a fail-closed single-commit publication assertion. Verified learning remains transient/artifact-scoped after the repair commit instead of advancing `execution` again. Added `test:promotion-closure` coverage rejecting `SECOND_SHA`, `ACTION_REPAIR_TWO_COMMITS`, and requiring the single-commit invariant.
**Prevention:** A completed verified repair session may advance `execution` exactly once. Learning that is not part of the source repair must remain artifact-scoped or be included before the single repair commit; it must never create a follow-up execution commit.
