# Active Repair Cycle Protocol

## Status
Canonical repair-cycle protocol. Instruction text is subordinate to protocol validators, execution control, security controls, exact-SHA evidence, and canonical certification.

## Purpose
When Canonical CI reports a real failure, the agents must repair the demonstrated root cause inside the single canonical working branch: `execution`. `main` remains the production/source-of-truth branch.

## Canonical route
```text
RED / active CI state
  ↓
CAPTURE exact SHA + run + job + step + evidence
  ↓
ERROR AGENT diagnosis / RCA
  ↓
TASK AGENT preparation packet
  ↓
AUTHORIZED EXECUTION on execution
  ↓
PROPORTIONAL HARDENING
  ↓
TARGETED REGRESSION
  ↓
AFFECTED CONTRACT GRAPH
  ↓
STATIC + BUILD + REQUIRED CHECKS
  ↓
CANONICAL CI on exact execution SHA
  ↓
NEW RED? → SAME REPAIR CYCLE ON execution
  ↓
GREEN → exact-SHA proof → certification → execution → main → verify
```

## Two-branch invariant
The repository has exactly two active branch paths:
- `execution`: the only working/repair/integration branch;
- `main`: the only production/source-of-truth branch.

**No third branch may be created or used under any circumstance.**

Historical branches may remain as archived Git history, but they are not valid execution paths and must never be selected for new work.

## Single repair authority
The role separation is:
- **Error Agent:** diagnosis, fingerprinting, recurrence detection, evidence preparation; no source mutation.
- **Task Agent:** implementation preparation and exact change packet; no source mutation, commit, push, PR, merge, certification, or GREEN.
- **Execution/Repair Agent:** authorized bounded mutation on `execution` only.
- **Verifier/Certification authority:** verification and canonical closure only.

The bounded repair engine is an execution backend under the authorized Execution/Repair Agent, not a competing repair owner.

## Immediate repair rule
For every actionable RED:
1. capture exact failed SHA and evidence;
2. bind the failure to the current repair chain;
3. require strong causal evidence before mutation;
4. prepare the smallest safe root-cause correction;
5. apply only after execution admission on `execution`;
6. apply proportional hardening only when justified;
7. run targeted regression and affected-contract verification;
8. run required Canonical CI;
9. attach every new RED to the same repair cycle when it is within the active boundary.

If `execution` is not safely synchronized with the current `main` baseline, the cycle fails closed. It must not create a third branch to escape the conflict.

## Automatic same-cycle interception
A new error while the cycle is active:
- keeps the same repair-chain identity when inside the same causal boundary;
- is captured with run/job/step/evidence;
- is fingerprinted and classified;
- becomes a new repair target on `execution) when actionable;
- receives root-cause correction, proportional hardening, regression, and full rescan.

A new error does not create a new branch, PR lane, or independent repair path.

## Same-cycle state machine
```text
ACTIVE_CYCLE
  ├─ OBSERVE_TEST_STATE
  ├─ RED_DETECTED → CAPTURE → RCA → PREPARE → CORRECT → HARDEN → VERIFY
  ├─ NEW_RED_DETECTED → ATTACH_TO_SAME_CYCLE → RCA → PREPARE → CORRECT → HARDEN → VERIFY
  ├─ RECURRENCE → USE_MEMORY → NEW_EVIDENCE_REQUIRED → CORRECT/HARDEN
  └─ ALL_REQUIRED_GREEN → EXACT-SHA PROOF → LEARN → PROMOTE execution→main
```

## Correction rule
The first corrective action must address the demonstrated root cause. Adding a test, changing a timeout, suppressing a warning, skipping a check, or weakening a gate is not a root repair unless evidence proves that behavior is the actual defect.

## Liveness and continuity
While assigned work remains open:
- active work may not silently become abandoned;
- waiting on CI or an external service is an explicit waiting state, not completion;
- stale heartbeat/lease moves to recovery handling, not CLOSED;
- repeated no-progress cycles require new evidence or strategy rotation;
- abort requires explicit authority;
- if evidence is insufficient, preserve the handoff and fail closed.

### Active 45-minute repair residency
Every unresolved repair cycle enters ACTIVE_REPAIR_45M. The session MUST remain continuously active for at least 45 minutes; SLEEP, IDLE, SILENT, ABANDONED, self-abort, self-disable, timeout-as-exit, and BLOCKED logout are forbidden. Heartbeat is mandatory and stale heartbeat triggers recovery rather than closure. Reaching 45 minutes is only a minimum residency condition; completion still requires zero remaining work/open RCA, Canonical GREEN, Exact-SHA certification, and the existing exit lock.

## Safety boundaries
- `mainBranchMutation` is always `false) during repair.
- Authorized execution may commit and push only to `execution`.
- No force-push or history rewrite on `main`.
- No third branch may be created by any repair, prompt, test, recovery, or automation path.
- No gate may be skipped, weakened, falsified, or converted into a non-test merely to obtain GREEN.
- Canonical CI remains the final authority.
- Unresolved or unsafe cases fail closed rather than creating another path.

## Evidence contract
Each active repair packet should retain:
`repairChainId`, `repairAttempt`, `failureRunId`, `failedSha`, `failureFingerprint`, `testStateSnapshot`, `causalEvidence`, `rootCause`, `sourceCorrection`, `hardeningControl`, `regressionProof`, `canonicalExactShaEvidence`, and `preventionOutcome`.

## Action-log learning mandate
The repair lifecycle MUST learn from both successful and failed GitHub Actions runs:
1. read recent canonical workflow logs for GREEN and RED runs;
2. fingerprint and normalize observations;
3. record workflow, run ID, exact SHA, job evidence, root-cause/features and observed repair rules;
4. treat successful runs as positive evidence and failed runs as negative evidence;
5. merge repeated evidence only after provenance checks;
6. keep derived learning advisory until fresh targeted proof and exact-SHA verification promote a rule;
7. never treat an action log or historical lesson as permission to bypass RCA, regression, certification, or fail-closed boundaries.

## Preparation contract
A Task Preparation Packet should bind:
`baselineSha`, `failureFingerprint`, `scope`, `dependencies`, `proofObligations`, `preparedChanges`, `verification`, `blockers`, and `handoffConsumer`.

For UPDATE/DELETE preparation, the exact baseline SHA/content identity must be captured. A changed baseline invalidates stale prepared changes and requires re-preparation.

## Major repair wave
When the autonomous repair workflow sets `FLIXO_MAJOR_REPAIR_WAVE=true`, use the expanded bounded profile declared by the current machine contract. The profile may increase cycle/file inspection budgets but **never** changes:
- execution-only mutation;
- main immutability;
- two-branch topology;
- exact-SHA/RCA/regression/security/certification gates;
- proportional scope;
- fail-closed behavior.

Any exhausted budget requires review/redispatch rather than silent truncation.

## Closure
`CLOSED / VERIFIED` is permitted only after Canonical CI is green on the exact `execution` SHA, with zero required red checks, fresh evidence, no unprocessed actionable failure, and canonical certification evidence.

Promotion to `main` must use only the canonical `execution → main` path.
