# 🔁 Agent Session Handoff Report Contract v1

Every completed agent session MUST produce a machine-readable handoff report for the next agent.

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
