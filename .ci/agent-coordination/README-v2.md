# FLIXO Multi-Agent Collaboration Protocol v2

This directory is the shared control plane for parallel engineering agents. Git branches and exact SHAs are the provenance layer; `claims.json` is the writable-scope authority; CI validators are the enforcement layer.

## Non-negotiable invariants

1. Every writing agent checks in before modifying repository scope.
2. An active claim binds `agentId + branch + observedHeadSha + paths + contracts + rootCauseIds + lease`.
3. Path, contract, or root-cause overlap with another active claim is fail-closed.
4. A changed HEAD invalidates the claim. The agent must re-ingest and re-claim.
5. A stale or expired lease cannot authorize writes; it never permanently blocks a new owner.
6. Heartbeats renew a lease only when branch and exact SHA are unchanged.
7. Handoff is explicit. The outgoing agent marks `handoff-pending`; the incoming agent creates a fresh claim against its own exact SHA.
8. Diagnostics have read authority only. A claim does not authorize merge, release, or certification.
9. Certification is singular: the Full Matrix remains the canonical release authority.
10. Every handoff and coordination event produces an evidence record containing timestamp, SHA, actor, action, and state hash.

## Lifecycle

`DISCOVERED -> CHECKED_IN -> IMPLEMENTING -> HEARTBEATING -> VERIFYING -> HANDOFF_PENDING/RELEASED`

A collision or SHA drift transitions the agent to `RE-INGEST_REQUIRED` and invalidates the write lease.

## Roles

- Planner: defines required work, contracts and root-cause objectives.
- Writer: owns exactly one disjoint scope at a time.
- Diagnostic: inspects and reports without write authority.
- Verifier: validates evidence against exact SHA and contract graph.
- Certification Authority: Full Matrix only.

## Shared communication surface

Use repository state as the coordination plane. Commits, claims, evidence artifacts, handoff records and PR discussion are authoritative, reviewable and reproducible. Never coordinate by hidden local state or an undocumented side channel.

## Operational commands

Status: `node scripts/ci/agent-coordination-protocol.mjs`

Check-in requires `FLIXO_AGENT_ID`, `FLIXO_AGENT_PATHS`, and/or contracts/root-cause IDs.

Heartbeat renews only when branch and exact SHA are unchanged.

Handoff uses `FLIXO_AGENT_ACTION=handoff` and `FLIXO_AGENT_HANDOFF_TO`.

Release uses `FLIXO_AGENT_ACTION=check-out`.

All mutating actions fail closed outside an `agent/<family>/<name>` branch and whenever the exact SHA is missing or stale.
