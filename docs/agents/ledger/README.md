# Agent Visibility Ledger

Canonical cross-agent coordination ledger: `docs/agents/ledger/<sessionId>.json`.

Each agent MUST declare `taskId` at login. Login creates an `OPEN/RUNNING` record. Logout closes the same record with `finalStatus=VERIFIED|BLOCKED` and a mandatory `finalSummary` before the session/task can close.

Required durable fields include:

`taskId, sessionId, agentId, role, entrySha, exitSha, status, finalStatus, finalSummary, scope, currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, activity, lastEvent, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent, visibilityState, updatedAt`.

Per-session files are intentional: they prevent all agents from contending on one shared append-only file. Other agents should read these records before accepting overlapping work. Runtime `diagnostics/agents/` state remains ephemeral; this ledger is the durable cross-agent visibility surface.

The ledger is coordination evidence only. It cannot override ownership locks, exact-SHA requirements, tests, CI or certification. Ledger records must never contain secrets, tokens, credentials or private user data.


## Live activity gate

An OPEN agent session MUST publish meaningful execution events with `node scripts/ci/agent-session.mjs event --session=<id> --agent=<id> --task=<task-id> --type=<TYPE> --summary=<what-happened>`. Event types: `PROGRESS`, `FINDING`, `BLOCKER`, `CHANGE`, `TEST`, `VERIFICATION`, `HANDOFF`, `NOTE`. Events carry the exact SHA and are visible to all agents. VERIFIED logout is fail-closed when no activity event exists. Event payloads reject common secret-like values and must contain no credentials or private user data.


## Work-package binding

New session records use ledger schema v2 and carry a mandatory `workPackageId` with the `ONE_TASK_ONE_WORK_PACKAGE` contract. The ID is immutable for the session and binds changes, evidence, handoff, and exact-SHA qualification. Historical schema-v1 records remain readable and are not rewritten retroactively.

Event evidence is fail-closed: CHANGE events require files; TEST/VERIFICATION events require evidence; FINDING events require findings; BLOCKER events require blockers.
