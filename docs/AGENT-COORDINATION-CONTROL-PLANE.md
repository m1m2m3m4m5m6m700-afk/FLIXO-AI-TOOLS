# FLIXO Agent Coordination Control Plane v2

The repository uses one shared control plane for multi-agent execution and one durable per-session visibility ledger. Runtime locks/state protect active ownership; the visibility ledger makes each agent's task and final outcome readable by the other agents.

## State

`diagnostics/agents/coordination-state.json` is the canonical machine-readable queue state. It tracks tasks, dependencies, owners, sessions, authoritative SHA and task lifecycle.

`diagnostics/agents/coordination-locks.json` is the canonical scope/RCA lock ledger. An active lock conflicts when the RCA is identical or when mutable scope overlaps.

## Task packets

Each task has a packet at `diagnostics/agents/task-packets/<TASK_ID>.json` containing objective, known failure, RCA, scope, lane, dependencies and required evidence. Agents claim packets instead of inventing parallel work.

## Scheduling

Tasks may be `READY`, `QUEUED`, `RUNNING`, `DONE`, or `STALE` when their baseline or ownership evidence is no longer current. `STALE` tasks must be revalidated before execution. Dependencies must be `DONE` before a task can be claimed. Higher priority should be scheduled first by the coordinating agent. Independent scopes may run concurrently; overlapping scopes are rejected.

## Session continuity

A new agent session consumes the predecessor handoff before executing inherited work. Handoff reports are continuity input, never proof of completion. A new session must refresh the exact `main` SHA and must not continue from stale state.

## Safe completion

A task cannot become `DONE` while `remainingWork` or `openRcas` exist. A session cannot logout as `VERIFIED` while failed work, remaining work or open RCAs exist.

## Evidence

Task completion records exact exit SHA, evidence and findings. Primary certification remains owned by the canonical certification authority. Coordination state never substitutes for product evidence.

## Communication ingress and delivery

Agent communication is part of this same control plane; it is not a second registry or protocol.

`Master Inbox (Issue #761) → agent-communication-relay.yml → agent-communication.mjs → agent-session.mjs → agent-coordination.mjs`.

The inbox lifecycle is `RECEIVED → READ → CONSUMED`. `STALE` and `BLOCKED_CONFLICT` are fail-closed states.

Every actionable message carries `messageId`, `idempotencyKey`, `recipient`, `taskId`, `scope`, `entrySha`, `risk`, dependencies and proof obligations. A duplicate delivery is a NO-OP. Reuse of a message identity with different content is an idempotency collision.

The event-driven relay is the primary delivery mechanism. Polling/supervision is recovery only. An agent session carrying an inbound `messageId` must read that message before task claim; task claim then revalidates message SHA, recipient, task and scope before acquiring the ownership lock.

Receipt or READ state never grants execution authority.
## CLI

`node scripts/ci/agent-coordination.mjs task-create ...`

`node scripts/ci/agent-coordination.mjs task-claim ...`

`node scripts/ci/agent-coordination.mjs task-release ...`

`node scripts/ci/agent-coordination.mjs task-complete ...`

`node scripts/ci/agent-coordination.mjs ingest-handoff ...`

`node scripts/ci/agent-coordination.mjs state`

## Durable cross-agent visibility

Runtime files under `diagnostics/agents/` remain generated coordination state and may be absent from Git. The tracked cross-agent reading surface is:

`docs/agents/ledger/<sessionId>.json`

Every agent MUST login with `--task=<task-id>`. Login creates an OPEN/RUNNING record. Logout MUST write the final status and final summary. `task-complete` accepts only a VERIFIED closed record with a matching handoff and exact exit SHA; `task-release` accepts only a VERIFIED or BLOCKED closed record.

To inspect all visible agent records:
`node scripts/ci/agent-coordination.mjs visible`

Visibility never transfers authority and never replaces CI/certification evidence.
