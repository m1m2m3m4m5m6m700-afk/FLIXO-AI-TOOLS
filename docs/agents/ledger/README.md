# Agent Visibility Ledger

Canonical cross-agent coordination ledger: `docs/agents/ledger/<sessionId>.json`.

Each agent MUST declare `taskId` at login. Login creates an `OPEN/RUNNING` record. Logout closes the same record with `finalStatus=VERIFIED|BLOCKED` and a mandatory `finalSummary` before the session/task can close.

Required durable fields include:

`taskId, sessionId, agentId, role, entrySha, exitSha, status, finalStatus, finalSummary, scope, currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent, visibilityState, updatedAt`.

Per-session files are intentional: they prevent all agents from contending on one shared append-only file. Other agents should read these records before accepting overlapping work. Runtime `diagnostics/agents/` state remains ephemeral; this ledger is the durable cross-agent visibility surface.

The ledger is coordination evidence only. It cannot override ownership locks, exact-SHA requirements, tests, CI or certification. Ledger records must never contain secrets, tokens, credentials or private user data.
