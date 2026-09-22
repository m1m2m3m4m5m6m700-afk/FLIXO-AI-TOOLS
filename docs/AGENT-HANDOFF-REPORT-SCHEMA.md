# 🔁 Agent Session Handoff Report Contract v1

Every completed worker session MUST produce a machine-readable handoff report for Chair 1. The report is a candidate-result handoff, not a branch publication.

Canonical path:

`diagnostics/agents/handoffs/<sessionId>.json`

The report is created by `scripts/ci/agent-session.mjs logout` and is part of the session ledger.

Required fields:

`schemaVersion, reportId, sessionId, agentId, role, entrySha, exitSha, startedAt, finishedAt, status, scope, currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, cycleLessons, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent`.

`cellLabConsensus` is mandatory for every handoff that covers material execution/mutation. It contains the Cell-Lab packet identity, exact SHA, integrated plan hash, consensus status and unresolved-question/conflict state. A successor must revalidate it against the current exact SHA before mutation.

`completedWork` contains only work actually performed and verified.

`failedWork` contains attempted work not proven successful.

`remainingWork` contains unresolved execution work.

`executionPlanNext` is an ordered continuation plan. The next agent MUST ingest it as input state and MUST NOT treat it as proof of completion.

`handoffToNextAgent` gives explicit operational instructions and conflict constraints.

## Continuation

A successor session SHOULD login with:

`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --from-session=<previous-session> ...`

When supplied, the previous session MUST be closed as `VERIFIED` or `BLOCKED`, its handoff report MUST exist, and its `exitSha` becomes `inheritedExitSha`.

The new session MUST record `continuationFrom, inheritedExitSha, inheritedRemainingWork, inheritedOpenRcas, inheritedNextPlan`.

Before editing, the successor MUST compare the inherited `exitSha` with the current exact `execution` SHA and re-check ownership of RCA and mutable scope. Handoff admission MUST fail closed when the predecessor `exitSha` is stale, the requested scope expands, or the repository topology is not `execution`. A handoff never silently transfers ownership and never overrides newer repository state.

Handoff reports are continuity evidence, not final certification evidence. They MUST NOT convert FAIL, CANCELLED, NOT_EXECUTED, MISSING_EVIDENCE, or MALFORMED_EVIDENCE into PASS.


## Cycle lessons
Every completed repair/verification cycle MUST include `cycleLessons`: an ordered list of the cycle's RCA lesson, strategy lesson or anti-lesson, verification lesson, affected-scope lesson when applicable, recurrence/prevention rule, and external-blocker anti-lesson when applicable. `cycleLessons` is continuity/learning evidence only and never authorizes mutation or certification.


## Isolated workspace result

Worker sessions operating under `FLIXO-AGENT-ISOLATED-WORKSPACE-v1` MUST include:

- `workspaceResult`
- `entrySha`
- `mainShaAtEntry`
- `executionShaAtEntry`
- `changedFiles`
- `patchSha256`
- `editableBy: CHAIR_1`
- `publicationAuthority: CHAIR_1`

The worker's `exitSha` is the workspace entry snapshot, not a claim about the current execution head.

A later movement of `execution` MUST NOT invalidate the worker's result. Chair 1 is responsible for reconciling the result against the newest execution/main state.

## Chair-1 preemption handoff

When a worker loses Chair 1 because another authorized master takes the seat, the session does not become abandoned.

The handoff MUST preserve:

- `preemptionContinuity.status = CONTINUING_AFTER_PREEMPTION`
- original `taskId`
- original `targetSha`
- displaced agent identity
- new Chair-1 holder identity
- `mutationAuthorityRevoked = true`
- `canContinueTask = true`
- `canMutateAfterPreemption = false`
- `handoffTo = CHAIR_1_GUARD`
- `remainingWork`
- `executionPlanNext`
- `blockers`
- exact evidence and cycle lessons.

The displaced agent may continue its session and then close with a handoff to the guard. A successor must revalidate the current exact SHA and RCA before applying any inherited change.

## Guard Change Report

Every worker handoff that contains material change information MUST include `guardChangeReport` created by `scripts/ci/guard-communication.mjs`.

The report is a cloned communication envelope dedicated to `CHAIR_1_GUARD` and MUST preserve:

- `reportId`, `idempotencyKey`, `agentId`, `taskId`
- `entrySha`, `executionShaAtEntry`, `mainShaAtEntry`
- `changedFiles` and `changeDetails`
- `patchSha256` and `resultId` when available
- `resultStatus`, `risk`, `summary`, `evidence`
- `remainingWork`, `blockers`, `nextActions`
- `publicationAuthority: CHAIR_1`
- `editableBy: CHAIR_1`

The guard report is a **receipt and full-detail-request surface only**. It does not grant mutation authority, merge authority, certification, or GREEN.

The guard MUST NOT reject, delete, discard, downgrade, suppress, or judge any substantive change reported by a worker. Every worker contribution is preserved exactly as received.

The guard may only:
- record receipt;
- ask the originating agent for missing/full change details;
- record the additional details supplied by that same agent.

Once the required details are present, the complete report remains available to Chair 1. Chair 1 is the final and only filter and the only authority that can edit, integrate, combine, remove, upgrade, commit, publish, or decide what reaches canonical execution.
