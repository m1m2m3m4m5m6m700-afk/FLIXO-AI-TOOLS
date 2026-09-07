# Collaboration Control Plane

The repository implements three complementary layers:

**Ownership:** `claims.json` binds one writer to an exact branch/SHA and a disjoint scope.

**Communication:** PRs, handoff packets, commit messages, evidence artifacts and the coordination dashboard expose progress, decisions, blockers and verification state.

**Enforcement:** local hooks, session validation, protocol-graph validation and cross-branch collision checks fail closed when provenance, ownership or scope invariants are violated.

## Required event vocabulary

`CHECK_IN`, `HEARTBEAT`, `SCOPE_REVIEW`, `RE_INGEST`, `VERIFY`, `HANDOFF`, `CHECK_OUT`, `COLLISION`, `BLOCKED_EXTERNAL`.

Each event should identify the exact SHA and produce machine-readable evidence. A changed SHA is never silently treated as the same session.

## Parallelism rule

Agents may execute in parallel only when their active claims are disjoint by path, contract and Root Cause ID. Shared certification is read-only and canonical; writers never certify their own release solely from local success.

## Conflict resolution

1. Freeze the conflicted write scope.
2. Record `COLLISION` with both exact SHAs and claims.
3. The affected agent re-ingests the latest target state.
4. Re-scope or handoff explicitly.
5. Re-run collision and contract validation before continuing.

No merge, cherry-pick, rebase or force-push is considered a coordination event that can preserve an old claim; all such SHA changes require re-ingestion.
