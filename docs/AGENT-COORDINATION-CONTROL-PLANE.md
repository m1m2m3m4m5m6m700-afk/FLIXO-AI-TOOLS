# FLIXO Agent Coordination Control Plane v1

The repository uses one shared control plane for multi-agent execution.

## State

`diagnostics/agents/coordination-state.json` is the canonical machine-readable queue state. It tracks tasks, dependencies, owners, sessions, authoritative SHA and task lifecycle.

`diagnostics/agents/coordination-locks.json` is the canonical scope/RCA lock ledger. An active lock conflicts when the RCA is identical or when mutable scope overlaps.

## Task packets

Each task has a packet at `diagnostics/agents/task-packets/<TASK_ID>.json` containing objective, known failure, RCA, scope, lane, dependencies and required evidence. Agents claim packets instead of inventing parallel work.

## Scheduling

Tasks may be `READY`, `QUEUED`, `RUNNING`, `DONE` or returned to `READY`. Dependencies must be `DONE` before a task can be claimed. Higher priority should be scheduled first by the coordinating agent. Independent scopes may run concurrently; overlapping scopes are rejected.

## Session continuity

A new agent session consumes the predecessor handoff before executing inherited work. Handoff reports are continuity input, never proof of completion. A new session must refresh the exact `main` SHA and must not continue from stale state.

## Safe completion

A task cannot become `DONE` while `remainingWork` or `openRcas` exist. A session cannot logout as `VERIFIED` while failed work, remaining work or open RCAs exist.

## Evidence

Task completion records exact exit SHA, evidence and findings. Primary certification remains owned by the canonical certification authority. Coordination state never substitutes for product evidence.

## CLI

`node scripts/ci/agent-coordination.mjs task-create ...`

`node scripts/ci/agent-coordination.mjs task-claim ...`

`node scripts/ci/agent-coordination.mjs task-release ...`

`node scripts/ci/agent-coordination.mjs task-complete ...`

`node scripts/ci/agent-coordination.mjs ingest-handoff ...`

`node scripts/ci/agent-coordination.mjs state`
