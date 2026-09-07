# Multi-Agent Cooperation & Concurrency Control Protocol

## Purpose

Allow the number of engineering agents to increase or decrease without introducing concurrent-write corruption, stale-SHA repairs, competing certification, or permanent locks.

## Non-negotiable invariants

1. One agent owns one writable scope at a time.
2. Every writable agent works from an isolated agent branch; the integration branch is not an agent workbench.
3. Every write is conditional on the exact blob/parent SHA that was observed before the write.
4. A changed HEAD, changed target blob, or overlapping scope invalidates the write attempt and requires re-ingestion.
5. Diagnostics may observe another agent's scope but may not write into it.
6. Execution may be parallel; certification remains singular and canonical.
7. Agent count is unbounded by protocol. Safety is provided by scope isolation and conflict detection, not by a fixed worker count.
8. Agent removal releases its claim. Expired claims are ignored after the lease TTL and must not become permanent blockers.
9. A claim never authorizes a merge. Integration and certification remain separate authorities.

## Claim record

Each active claim has:

- `agentId`: stable logical agent identifier.
- `branch`: isolated agent branch.
- `observedHeadSha`: 40-hex SHA observed before work begins.
- `scope.paths`: exact path or directory scopes owned for writing.
- `scope.contracts`: contract IDs owned for writing.
- `rootCauseIds`: root causes being repaired.
- `status`: `active` or `released`.
- `leasedAt`: ISO timestamp.
- `leaseUntil`: ISO timestamp.

## Conflict rules

Two active claims conflict when they share a path scope, one path scope contains the other, or they share a contract ID or root-cause ID. Conflicting claims are a hard failure.

A stale `observedHeadSha` is not repaired automatically. The agent must re-ingest the current state and issue a new claim.

## Scaling rules

Adding an agent creates a new claim and new isolated branch; it never expands another agent's scope.

Removing an agent marks its claim `released`. The released record may remain for evidence history, but it no longer participates in active conflict checks.

If an agent disappears without releasing its lease, the TTL expires it. Another agent may then claim the same scope, but only after the validator observes the previous claim as expired.

## Certification ownership

`full-matrix-parallel.yml` owns the canonical browser execution matrix and its single `Full Matrix Certification`. Agent coordination must never introduce a second certification authority.

## Required transition

`DISCOVERED -> CLAIMED -> IMPLEMENTING -> VERIFYING -> RELEASED`

A detected collision transitions to:

`COLLISION_DETECTED -> RE-INGEST -> RE-CLAIM`

Continuing to write after `COLLISION_DETECTED` is forbidden.
