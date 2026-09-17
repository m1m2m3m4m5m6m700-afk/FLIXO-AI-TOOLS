# Active Repair Cycle Protocol

## Purpose
When Canonical CI reports a real failure, the agents must work on the **current failure inside the same repair cycle**. A new test is not a substitute for correcting the demonstrated source/configuration/workflow defect.

## Required order
```text
FAILURE / ACTIVE TEST STATE
  ↓
CONTINUOUS TEST-STATE AWARENESS
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
COMMIT + PUSH on isolated repair branch
  ↓
CANONICAL CI on exact pushed SHA
  ↓
NEW RED? → SAME REPAIR CYCLE, SAME FAILURE CHAIN
  ↓
GREEN → learn / close
```

## Task Agent is the execution authority
The Task Agent is not a preparation-only planner. For an active failure it is the **single repair owner** and the repair workflow must bind the failure context to a named isolated repair branch before execution.

The bounded repair engine is an **execution backend under Task Agent authority**, not a competing repair owner. It may perform only the evidence-gated mutation selected for the active failure. The Task Agent contract owns:
- failure binding;
- scope and mutation authorization;
- root-cause evidence requirements;
- execution ordering;
- regression and proof requirements;
- commit/push on the isolated repair branch;
- re-opening the same repair chain for every new RED;
- closure only after Canonical CI GREEN on the exact pushed SHA.

A detached worktree is not a valid Task Agent execution target because it has no named repair branch. The active repair workflow must create and validate a named branch before invoking the Task Agent.

## Immediate repair rule
For every actionable RED in an active cycle:
1. capture the exact failed SHA and failure evidence;
2. bind the Task Agent to that failure context;
3. require strong causal evidence before mutation;
4. execute the smallest safe root-cause correction through the bounded repair backend under Task Agent authority;
5. verify the repair and commit/push it on the isolated repair branch;
6. run Canonical CI on the pushed SHA;
7. attach every new RED to the same repair chain and immediately open the next bounded repair attempt.

The workflow must not stop at a generated proposal when the evidence gate authorizes a safe mutation. If evidence is insufficient or the repair is unsafe, it must fail closed with an explicit escalation packet rather than fabricate a repair.

## Test-state awareness
The repair agent must maintain an **active view of the test system** throughout the repair cycle, not inspect tests only after a failure is reported.

At each cycle checkpoint it must inspect, when available:
- current required-check state;
- in-progress, queued, failed, cancelled, and timed-out runs relevant to the target SHA;
- workflow/job/step conclusions and failure evidence;
- the exact SHA under repair;
- newly appearing failures introduced by the repair;
- previously known failure fingerprints and their prevention status.

The agent should refresh this view before diagnosis, after applying a correction, after targeted regression, and before closure. Monitoring is observational and must not weaken, skip, cancel, or falsify required verification.

## Automatic same-cycle interception
If a new error appears while the current repair cycle is active:
1. bind it to the current repair-chain ID and target SHA;
2. capture its run/job/step and evidence;
3. fingerprint and classify it;
4. determine whether it is the original failure, a recurrence, or a newly introduced failure;
5. if it is actionable, open a **new repair attempt inside the same repair chain**;
6. correct the demonstrated root cause and apply proportional hardening;
7. re-run the affected proof and then rescan all required checks;
8. continue until the chain reaches canonical GREEN or a bounded fail-closed escalation.

A new error does **not** create an unrelated task, PR, repair-chain ID, or closure opportunity. A separate isolated repair branch may still be used for safe source publication, but it remains attached to the same active repair chain and exact target context.

## Same-cycle repair state machine
```text
ACTIVE_CYCLE
  ├─ OBSERVE_TEST_STATE
  ├─ RED_DETECTED → CAPTURE → RCA → CORRECT → HARDEN → VERIFY
  ├─ NEW_RED_DETECTED → ATTACH_TO_SAME_CYCLE → RCA → CORRECT → HARDEN → VERIFY
  ├─ RECURRENCE → USE_MEMORY → NEW_EVIDENCE_REQUIRED → CORRECT/HARDEN
  └─ ALL_REQUIRED_GREEN → EXACT-SHA PROOF → LEARN → CLOSE
```

The cycle ID and target SHA are immutable for the active chain. A child repair attempt may have its own attempt number and fingerprint, but it must retain the parent cycle identity.

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

Any red result becomes a repair target in the **same repair chain**. The system must not close the task merely because a new test was added or a targeted command passed.

## Safety boundaries
- Task Agent is the **direct self-healing repair owner**; it may mutate source, commit, and push only on the isolated repair branch.
- Direct execution is strictly bounded by `SELF_HEALING_REPAIR_ONLY` and `FAIL_CLOSED`.
- `mainBranchMutation` is always `false`; the repair agent must never mutate `main`, force-push, rewrite history, or self-approve/merge.
- Every mutation must be tied to the active failure/task and its demonstrated root cause, proportional hardening, or required regression proof.
- The repair agent must not perform unrelated product, UI, SEO/i18n, performance, cleanup, or opportunistic refactor work.
- Canonical CI remains the final authority.
- No gate may be skipped, weakened, falsified, or converted into a non-test merely to obtain GREEN.
- If the evidence is insufficient, the cycle stays open for diagnosis rather than inventing a root cause.
- Continuous observation must not become unbounded polling: use bounded checkpoints and fail-closed circuit breakers.

## Evidence contract
Each active repair packet should retain:
`repairChainId`, `repairAttempt`, `failureRunId`, `failedSha`, `failureFingerprint`, `testStateSnapshot`, `causalEvidence`, `rootCause`, `sourceCorrection`, `hardeningControl`, `regressionProof`, `canonicalExactShaEvidence`, and `preventionOutcome`.

## Closure
`CLOSED / VERIFIED` is permitted only after Canonical CI is green on the exact pushed SHA with zero required red checks, fresh evidence, and no unprocessed active test failure.
