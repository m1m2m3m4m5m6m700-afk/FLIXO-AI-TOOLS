# FLIXO Agent Coordination Control Plane v1

The repository has one machine-readable coordination plane for multi-agent execution.

`diagnostics/agents/coordination-state.json` tracks tasks, dependencies, owner/session, lifecycle and authoritative SHA.

`diagnostics/agents/coordination-locks.json` is the active RCA/mutable-scope lock ledger. A claim conflicts when RCA matches or a mutable scope overlaps another active lock.

`diagnostics/agents/task-packets/<TASK_ID>.json` contains the executable task packet: objective, known failure, priority/lane, dependencies, RCA, scope and required evidence.

Use `scripts/ci/agent-coordination.mjs` for task creation, claim, release, completion and predecessor handoff ingestion. Do not create parallel task ownership outside this plane.

Task lifecycle: `READY → RUNNING → DONE` or `READY → RUNNING → READY`. Dependencies must be `DONE` before a dependent task is claimable. Completion is fail-closed when remaining work or open RCAs exist.

A successor session must ingest its predecessor handoff before continuing inherited work. Handoff is continuity input, not certification evidence.

Independent tasks may run concurrently. Overlapping RCA or mutable scope is rejected. A moving `main` SHA requires refresh/replanning before further changes.

The coordination plane improves focus and speed without becoming a certification authority. Final certification remains owned by the canonical certification engine.
