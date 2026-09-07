# Agent Check-In Contract

Before any write operation, an agent must publish an active claim containing:

- unique `agentId`
- `agent/<family>/<name>` branch
- exact `observedHeadSha`
- writable paths
- contract IDs
- Root Cause IDs
- lease and heartbeat timestamps
- session ID

The check-in command is deterministic and collision-aware. It rejects overlap with any unexpired active claim by path, contract, or Root Cause ID.

A heartbeat is required before lease expiry and never advances the observed SHA. Any commit, rebase, merge, or other SHA change invalidates the claim and requires re-ingestion.

A handoff is two-phase: outgoing agent records `handoff-pending`, then incoming agent checks in on its own branch and SHA. There is no implicit transfer of write authority.

Check-out releases the claim explicitly. Expired claims are non-authorizing and may be reclaimed by a fresh exact-SHA check-in.

## Communication packet

Every agent should make these fields visible in its PR or handoff record: objective, scope, contracts, Root Cause IDs, observed SHA, current SHA, files touched, tests run, evidence artifacts, blockers, next action, and whether handoff is safe.
