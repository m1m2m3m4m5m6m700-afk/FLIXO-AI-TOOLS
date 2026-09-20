# Active Repair Cycle Protocol

## Purpose
When Canonical CI reports a real failure, the agents must repair the demonstrated root cause inside the single canonical working branch: `execution`. `main` remains the production/source-of-truth branch.

## Canonical route
```text
RED on main / active CI state
  ↓
CAPTURE exact SHA + run + job + step + evidence
  ↓
TASK AGENT binds the active failure
  ↓
ROOT-CAUSE / causal evidence
  ↓
SOURCE / CONFIG / WORKFLOW CORRECTION on execution
  ↓
PROPORTIONAL HARDENING
  ↓
TARGETED REGRESSION
  ↓
STATIC + BUILD + REQUIRED CHECKS
  ↓
PUSH execution
  ↓
CANONICAL CI on exact execution SHA
  ↓
NEW RED? → SAME REPAIR CYCLE ON execution
  ↓
GREEN → exact-SHA proof → execution → main → verify
```

## Two-branch invariant
The repository has exactly two active branch paths:
- `execution`: the only working/repair/integration branch;
- `main`: the only production/source-of-truth branch.

The repair system MUST NOT create or use any third branch. In particular, it must never create `flixo-auto-repair/*`, `fix/*`, `feature/*`, `agent/*`, `bot/*`, per-run, per-error, per-task, temporary, test, or diagnostic branches.

Historical branches are not active execution paths and must not be selected for new work.

## Task Agent is the execution authority
The Task Agent is the single repair owner. It may mutate source/configuration/workflow files only on `execution`, under `SELF_HEALING_REPAIR_ONLY` and `FAIL_CLOSED`.

The bounded repair engine is an execution backend under Task Agent authority, not a competing repair owner.

## Immediate repair rule
For every actionable RED:
1. capture the exact failed SHA and evidence;
2. bind the Task Agent to that failure context;
3. require strong causal evidence before mutation;
4. execute the smallest safe root-cause correction on `execution`;
5. apply proportional hardening when justified;
6. run targeted regression and required verification;
7. push the exact repaired `execution` SHA;
8. run Canonical CI;
9. attach every new RED to the same repair cycle and continue on `execution`.

If `execution` is not safely synchronized with the current `main` baseline, the cycle fails closed. It must not create a third branch to escape the conflict.

## Automatic same-cycle interception
A new error while the cycle is active:
- keeps the same repair-chain identity;
- is captured with run/job/step/evidence;
- is fingerprinted and classified;
- becomes a new repair target on `execution` when actionable;
- receives root-cause correction, proportional hardening, regression, and full rescan.

A new error does not create a new branch, PR lane, or independent repair path.

## Same-cycle state machine
```text
ACTIVE_CYCLE
  ├─ OBSERVE_TEST_STATE
  ├─ RED_DETECTED → CAPTURE → RCA → CORRECT → HARDEN → VERIFY
  ├─ NEW_RED_DETECTED → ATTACH_TO_SAME_CYCLE → RCA → CORRECT → HARDEN → VERIFY
  ├─ RECURRENCE → USE_MEMORY → NEW_EVIDENCE_REQUIRED → CORRECT/HARDEN
  └─ ALL_REQUIRED_GREEN → EXACT-SHA PROOF → LEARN → PROMOTE execution→main
```

## Correction rule
The first corrective action must address the demonstrated root cause. Adding a test, changing a timeout, suppressing a warning, skipping a check, or weakening a gate is not a root repair unless evidence proves that behavior is the actual defect.

## Safety boundaries
- `mainBranchMutation` is always `false` during repair.
- The Task Agent may commit and push only to `execution`.
- No force-push or history rewrite on `main`.
- No third branch may be created by the repair system.
- No gate may be skipped, weakened, falsified, or converted into a non-test merely to obtain GREEN.
- Canonical CI remains the final authority.
- Unresolved or unsafe cases fail closed rather than creating another path.

## Evidence contract
Each active repair packet should retain:
`repairChainId`, `repairAttempt`, `failureRunId`, `failedSha`, `failureFingerprint`, `testStateSnapshot`, `causalEvidence`, `rootCause`, `sourceCorrection`, `hardeningControl`, `regressionProof`, `canonicalExactShaEvidence`, and `preventionOutcome`.

## Action-log learning mandate
The Task Agent MUST learn from both successful and failed GitHub Actions runs during the repair lifecycle:
1. read recent canonical workflow logs for both GREEN and RED runs;
2. fingerprint and normalize the observations;
3. record workflow, run ID, exact SHA, job evidence, root-cause/features and observed repair rules;
4. treat successful runs as positive evidence and failed runs as negative evidence;
5. merge repeated evidence only after provenance checks;
6. keep derived learning advisory until fresh targeted proof and exact-SHA verification promote a rule;
7. never treat an action log or historical lesson as permission to bypass RCA, regression, certification, or fail-closed boundaries.

The action-learning path is part of the repair task, not an optional afterthought.

## Mandatory cycle lesson list
After every repair/verification cycle, the learning stage MUST emit a `cycleLessons` list before handoff or cycle transition.
The list MUST contain, when applicable:
1. `RCA` — the causal lesson linking trigger, propagation, violated invariant and causal source;
2. `STRATEGY` — a reusable lesson on the repair strategy, or an `antiLesson` when the strategy failed/repeated without proof;
3. `VERIFICATION` — what the verification state proved or did not prove, bound to the current exact SHA;
4. `SCOPE` — the bounded affected paths when mutation occurred;
5. `RECURRENCE` — the prevention rule that should stop the same failure from recurring;
6. `BLOCKER` — an explicit anti-lesson when the result is an external/provider blocker.

`cycleLessons` is learning evidence, not certification authority. It MUST travel with the handoff and remain bound to the cycle fingerprint and exact SHA. A missing lesson list is an incomplete cycle and must remain open.
## Major repair wave
When the autonomous repair workflow sets `FLIXO_MAJOR_REPAIR_WAVE=true`, the cycle enters the large-change bounded profile:
- up to 30 repair/verification cycles;
- up to 60 prepared source files per bounded repair packet;
- up to 240 inspected files per bounded repair packet;
- the execution-only mutation boundary remains active;
- `main` remains immutable to repair agents;
- exact-SHA, RCA, regression, certification, security and canonical GREEN gates remain mandatory;
- exceeding the expanded budget still fails closed and requires review/redispatch rather than silent truncation.

The expanded profile permits large source corrections and proportional hardening inside the active failure scope; it does not authorize unrelated product work, gate weakening, third-branch creation, or trust-control bypasses.

## Closure
`CLOSED / VERIFIED` is permitted only after Canonical CI is green on the exact `execution` SHA, with zero required red checks, fresh evidence, and no unprocessed active failure. Promotion to `main` must then use only the canonical `execution → main` path.
