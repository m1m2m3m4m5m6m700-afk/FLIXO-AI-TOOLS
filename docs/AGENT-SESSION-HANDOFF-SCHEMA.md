# 🔁 Agent Session Handoff Protocol v1

Every completed agent session MUST produce a machine-readable handoff report that becomes the continuity input for the next agent.

## Canonical report path

`diagnostics/agents/handoffs/<sessionId>.json`

The report is created automatically by `scripts/ci/agent-session.mjs logout` and is immutable after session closure.

## Required report contract

The report MUST contain:

`schemaVersion, reportId, sessionId, agentId, role, entrySha, exitSha, startedAt, finishedAt, status, scope, currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent, sourceSession`.

## Continuation rule

A new implementation, verification, recovery, or release session SHOULD reference the previous handoff explicitly:

`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --from-session=<previous-session> ...`

When `--from-session` is supplied, the previous session MUST be closed as `VERIFIED` or `BLOCKED`, its handoff report MUST exist, and its `exitSha` is recorded as the continuation source.

The new session MUST record:

`continuationFrom, inheritedExitSha, inheritedRemainingWork, inheritedOpenRcas, inheritedNextPlan`.

The new agent MUST treat the inherited remaining work and next plan as input state, not as a claim of verification. It MUST revalidate the exact current `main` SHA before making changes.

## Handoff semantics

`completedWork` = work actually performed and verified in the session.

`failedWork` = work attempted but not proven successful.

`remainingWork` = execution work intentionally left open.

`executionPlanNext` = ordered actions required to continue safely.

`blockers` = external or repository-local blockers that prevented closure.

`handoffToNextAgent` = explicit operational instructions for the next session.

No field may be used to convert an unverified action into PASS. Handoff reports are continuity evidence, not certification evidence.

## Conflict safety

A handoff does NOT transfer ownership silently. The receiving agent must compare the inherited `exitSha` against the current exact `main` SHA and compare mutable scope/RCA ownership before continuing.

If `main` moved or another active session owns the same mutable scope, the receiving agent MUST freeze the overlap and resolve ownership before editing.
