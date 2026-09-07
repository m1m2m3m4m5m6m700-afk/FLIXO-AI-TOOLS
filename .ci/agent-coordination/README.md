# Multi-Agent Cooperation & Concurrency Control Protocol

## Purpose

Allow the number of engineering agents to increase or decrease without introducing concurrent-write corruption, stale-SHA repairs, competing certification, or permanent locks.

## Non-negotiable invariants

1. One agent owns one writable scope at a time.
2. Every writable agent works from an isolated `agent/<agentId>/<work-id>` branch; the integration branch is not an agent workbench.
3. Every write is conditional on the exact blob/parent SHA that was observed before the write.
4. A changed HEAD, changed target blob, or overlapping scope invalidates the write attempt and requires re-ingestion.
5. Diagnostics may observe another agent's scope but may not write into it.
6. Execution may be parallel; certification remains singular and canonical.
7. Agent count is unbounded by protocol. Safety is provided by scope isolation and conflict detection, not by a fixed worker count.
8. Agent removal releases its claim. Expired claims are ignored after the lease TTL and must not become permanent blockers.
9. A claim never authorizes a merge. Integration and certification remain separate authorities.
10. `scripts/ci/active-sessions.json` is a transparent session view; `.ci/agent-coordination/claims.json` remains the sole ownership source of truth.

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

## Transparent session record

Each active session mirrors its matching claim in `scripts/ci/active-sessions.json` with:

- `agent_id` matching `claim.agentId`.
- `branch` matching `claim.branch`.
- `task` describing the active work.
- `claimed_paths` matching `claim.scope.paths`.
- `claimed_contracts` matching `claim.scope.contracts`.
- `started_at` as an ISO timestamp.

The session ledger is intentionally readable by every agent, but it cannot grant ownership independently. Any session without a matching unexpired claim is a hard failure.

## Check-in / work / check-out

Before the first write, an agent must:

1. Re-ingest the current branch HEAD.
2. Inspect the active session ledger and claims registry.
3. Create exactly one isolated agent branch.
4. Create one non-empty claim with path, contract, and root-cause scope plus an exact observed SHA.
5. Add the matching session entry.
6. Run the agent session guard before changing product or CI code.

During work, the agent must stop on any stale SHA, scope collision, claim drift, or session drift. It must re-ingest and re-claim before writing again.

On completion, the agent releases its claim and removes the corresponding active session entry. Released claim history may remain for evidence; active session state must not remain after checkout.

## Conflict rules

Two active claims conflict when they share a path scope, one path scope contains the other, or they share a contract ID or root-cause ID. Conflicting claims are a hard failure with `AGENT_COLLISION_DETECTED`.

A stale `observedHeadSha` is not repaired automatically. The agent must re-ingest the current state and issue a new claim.

The cross-branch guard also scans open same-repository agent PRs and fails closed when a peer claim is unreadable or collides with the current active claim.

## Scaling rules

Adding an agent creates a new claim and new isolated branch; it never expands another agent's scope.

Removing an agent marks its claim `released`. The released record may remain for evidence history, but it no longer participates in active conflict checks.

If an agent disappears without releasing its lease, the TTL expires it. Another agent may then claim the same scope, but only after the validator observes the previous claim as expired.

## Guard chain

The required safety chain is:

`Session Guard -> Local Claim Guard -> Cross-Branch Collision Guard -> Protocol Cooperation -> Canonical Matrix Certification`

Both CI and the protocol cooperation validator execute the session guard. There is no alternate local bypass path for the required contract suite.

## Certification ownership

`full-matrix-parallel.yml` owns the canonical browser execution matrix and its single `Matrix First Certification` job. Agent coordination must never introduce a second certification authority.

## Required transition

`DISCOVERED -> CLAIMED -> IMPLEMENTING -> VERIFYING -> RELEASED`

A detected collision transitions to:

`COLLISION_DETECTED -> RE-INGEST -> RE-CLAIM`

Continuing to write after `COLLISION_DETECTED` is forbidden.
