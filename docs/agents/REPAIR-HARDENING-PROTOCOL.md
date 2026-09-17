# FLIXO Repair Hardening Protocol

## Purpose
Every repair must do two things: remove the observed root cause and reduce the probability of recurrence. A repair is not complete merely because the original check becomes green.

## Mandatory closed-loop protocol
For every repair cycle:

1. **Capture** — record the exact failing check, SHA, workflow/run, job, error fingerprint and relevant evidence.
2. **Root cause** — identify the causal defect; do not treat a symptom, retry, timeout, or red status as the root cause.
3. **Repair** — make the smallest safe change that removes the root cause.
4. **Harden** — add at least one proportional prevention control whenever the failure exposes a reusable weakness. Examples: contract assertion, regression test, validation, deterministic serialization/locking, fail-closed guard, evidence binding, or observability.
5. **Verify** — reproduce the original failure and run the new regression/control plus the required regression gates.
6. **Rescan** — inspect the complete required gate set for newly exposed or introduced failures.
7. **Publish safely** — commit and push only to the isolated repair branch; never bypass canonical gates or weaken them to obtain GREEN.
8. **Canonical proof** — closure requires GREEN on the exact pushed SHA, zero required red checks, fresh evidence and regression proof.
9. **Learn** — record the root cause, hardening control, verification evidence and recurrence-prevention outcome in the repair/error memory.

## Hardening rules
- **No patch-only closure:** fixing the reported line/check without addressing a demonstrated systemic weakness is insufficient when a prevention control is technically applicable.
- **No weakening:** hardening must not disable, skip, downgrade, falsify, or broaden trust in existing security/verification gates.
- **Proportionality:** hardening must target the demonstrated failure mode; avoid unrelated scope expansion.
- **Evidence-bound:** every hardening claim must have a concrete verification obligation.
- **Fail closed:** ambiguous RCA, missing evidence, failed hardening verification, or conflicting contracts blocks closure.
- **Exact-SHA binding:** repair, hardening, tests and certification evidence must refer to the same pushed SHA before closure.
- **Regression becomes memory:** a recurring fingerprint must link to its prior RCA and prevention control rather than being treated as a brand-new unexplained failure.
- **Bounded loops:** repeated failures continue the repair cycle; circuit breakers may require review but never fabricate success.

## Required repair record
Each repair record should contain:
`failureFingerprint`, `baselineSha`, `rootCause`, `causalEvidence`, `repairChanges`, `hardeningWeakness`, `hardeningControl`, `verification`, `exactShaEvidence`, `regressionProof`, and `preventionOutcome`.

## Agent boundaries
The Task Agent may diagnose and prepare hardening changes but does not mutate source, commit, or push. The supervising execution agent applies the bounded repair/hardening packet. Canonical CI remains the final authority for closure.
