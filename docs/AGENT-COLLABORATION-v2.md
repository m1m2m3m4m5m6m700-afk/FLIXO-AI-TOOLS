# FLIXO Agent Collaboration v2

The collaboration model treats GitHub as the shared control plane and makes every writer observable, scoped, and SHA-bound.

## Safety invariants

- A writer checks in before writing.
- `claims.json` is the ownership authority.
- An active claim binds agent identity, agent branch, exact observed SHA, paths, contract IDs, Root Cause IDs, lease and heartbeat.
- Active claims may not overlap by path, contract ID or Root Cause ID.
- SHA drift invalidates the session and requires re-ingestion.
- Heartbeat renews only an unchanged branch/SHA.
- Handoff is explicit and two-phase; ownership never transfers implicitly.
- Diagnostics are read-only and certification is singular.
- Expired claims authorize nothing and can be reclaimed only by a fresh check-in.

## Visibility

Agents communicate through commits, pull-request discussion, structured handoff packets, event records and machine-readable evidence. The dashboard exposes active leases, SHA, scope and heartbeat health.

## Lifecycle

`DISCOVERED -> CHECKED_IN -> IMPLEMENTING -> HEARTBEATING -> VERIFYING -> HANDOFF_PENDING/RELEASED`

Collision or SHA drift moves the affected session to `RE-INGEST_REQUIRED`.

## Roles

Planner scopes work. Writer changes one claimed scope. Diagnostic inspects. Verifier checks evidence. Full Matrix certifies release. No role may elevate another role's authority.

## Agent command surface

`node scripts/ci/agent-coordination-protocol.mjs` provides status, check-in, heartbeat, handoff and check-out actions via environment variables. `validate-agent-coordination-protocol.mjs`, `validate-agent-sessions.mjs`, and `validate-agent-pr-collisions.mjs` enforce the state.
