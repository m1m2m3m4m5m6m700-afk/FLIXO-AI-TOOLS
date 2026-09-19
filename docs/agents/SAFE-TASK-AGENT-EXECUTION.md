# Safe Task Agent Execution

The Task Agent repairs GitHub Actions against the exact observed target SHA on `execution` or `main`. Canonical CI remains the final GREEN authority. Direct `main` mutation is permitted only under the exact-SHA repair boundary.

## Canonical lifecycle

```text
FAILURE
  ↓
capture exact SHA + run + job + evidence
  ↓
prove root cause with fresh exact-SHA evidence
  ↓
bounded source/config/workflow correction on execution
  ↓
proportional hardening + targeted regression
  ↓
push execution
  ↓
Canonical CI on the exact execution SHA
  ↓
ANY RED / CANCELLED / SKIPPED / TIMED_OUT / STALE REQUIRED CHECK
  → same active repair cycle
  ↓
ALL REQUIRED CHECKS GREEN
  ↓
exact-SHA proof
  ↓
execution → main
  ↓
verify resulting main identity and post-merge CI
```

## Branch and mutation invariants

- `execution` is the sole working, repair, and integration branch.
- `main` is the sole production/source-of-truth branch.
- The Task Agent must never create or select a third repair/feature/temporary branch.
- Direct mutation during repair is allowed only on `execution`.
- `main` mutation, force-push, and history rewriting during repair are forbidden.
- A repair cycle remains open after source mutation until Canonical CI is GREEN on the exact pushed `execution` SHA.
- A cancelled, skipped, timed-out, stale, or failed required check is never treated as GREEN.

## Evidence and closure

Every active repair cycle must retain:

`repairChainId + repairAttempt + failureRunId + failedSha + failureFingerprint + causalEvidence + rootCause + sourceCorrection + regressionProof + canonicalExactShaEvidence + preventionOutcome`

The Task Agent must address the demonstrated root cause before adding regression-only tests. A new test cannot substitute for the missing source correction.

Closure is allowed only when all of the following are true:

1. Canonical CI is green on the exact pushed `execution` SHA.
2. There are zero required red, cancelled, skipped, timed-out, or stale checks.
3. Fresh exact-SHA evidence proves the repair.
4. Required regression proof is present.
5. The canonical `execution → main` path completes and the resulting `main` state is independently verified.

## Trust boundary

Privileged diagnosis, repair strategy, and controller policy must use the trusted canonical-main controller snapshot and trusted learning input.

Execution-side learning is derived output only. Derived learning may be merged into trusted history only through validated, evidence-preserving normalization; it must never replace or weaken the canonical trust source.

## Escalation

Repeated failure with the same fingerprint and no verifiable progress opens the configured circuit breaker and fails closed. Intractable cases escalate for supervising-agent teaching instead of repeating rejected approaches.

A successful source repair is not completion by itself; the verifier owns closure only after exact-SHA Canonical CI GREEN and post-merge verification.
