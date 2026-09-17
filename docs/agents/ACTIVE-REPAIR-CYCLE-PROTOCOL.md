# Active Repair Cycle Protocol

## Purpose
When Canonical CI reports a real failure, the agents must work on the **current failure inside the same repair cycle**. A new test is not a substitute for correcting the demonstrated source/configuration/workflow defect.

## Required order
```text
FAILURE
  ↓
CAPTURE exact SHA + run + job + step + evidence
  ↓
TASK AGENT sees the active failure context
  ↓
ROOT-CAUSE / causal evidence
  ↓
SOURCE / CONFIG / WORKFLOW CORRECTION
  ↓
PROPORTIONAL HARDENING
  ↓
TARGETED REGRESSION (only as proof)
  ↓
STATIC + BUILD + REQUIRED CHECKS
  ↓
CANONICAL CI on exact SHA
  ↓
GREEN → learn / close
RED → same repair chain continues
```

## Visibility
The Task Agent may be invoked with:
- `--failure-run-id`
- `--failure-sha`
- `--failure-fingerprint`
- `--failure-evidence`

The generated packet must bind these values to the active repair cycle. This gives the Task Agent the same failure context being repaired instead of treating the work as an unrelated future task.

## Correction rule
The first corrective action must address the demonstrated root cause. Adding a test, changing a timeout, suppressing a warning, skipping a check, or weakening a gate is not considered a root repair unless the evidence proves that behavior is the actual defect.

A regression test is allowed only when it proves the source correction or hardening. It must not be used to make an existing failure appear green without correcting its cause.

## Same-cycle continuity
A repair attempt remains open until:
1. the original failure is reproduced or its causal evidence is otherwise established;
2. the source/configuration/workflow root cause is corrected;
3. proportional hardening is applied when the failure exposed a reusable weakness;
4. targeted regression proves the correction where appropriate;
5. all required checks are rescanned;
6. Canonical CI is green on the exact pushed SHA.

Any red result becomes a repair target in the same failure chain. The system must not close the task merely because a new test was added or a targeted command passed.

## Safety boundaries
- Task Agent remains preparation-only: no source mutation, commit, or push.
- Supervising execution agent applies the prepared correction.
- Repair work stays on an isolated repair branch.
- Canonical CI remains the final authority.
- No gate may be skipped, weakened, falsified, or converted into a non-test merely to obtain GREEN.
- If the evidence is insufficient, the cycle stays open for diagnosis rather than inventing a root cause.

## Evidence contract
Each active repair packet should retain:
`failureRunId`, `failedSha`, `failureFingerprint`, `causalEvidence`, `rootCause`, `sourceCorrection`, `hardeningControl`, `regressionProof`, `canonicalExactShaEvidence`, and `preventionOutcome`.

## Closure
`CLOSED / VERIFIED` is permitted only after Canonical CI is green on the exact pushed SHA with zero required red checks and fresh evidence.
