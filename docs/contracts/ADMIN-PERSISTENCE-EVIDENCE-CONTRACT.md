# FLIXO Admin Persistence & Evidence Contract

Status: ACTIVE / PHASE-2

## Authority
The Admin Control Plane reuses the existing Supabase REST persistence boundary. No parallel database or client-side source of truth is introduced.

## Durable identity/session
Every newly issued Admin session carries a random `sessionId` and is persisted in `public.flix_admin_sessions`.

Required server fields:
- session_id
- actor_subject
- actor_role
- environment
- issued_at
- expires_at
- revoked_at

A runtime Admin request carrying a durable session MUST fail closed when the session record is missing, revoked, expired, or when the session store is unavailable.

## Evidence
Evidence records are persisted in `public.flix_admin_evidence` with:
- assertion_id / claim_id
- exact_sha
- source / evaluator
- environment
- status
- freshness_at / expires_at
- payload
- integrity_sha256

Read-back MUST verify the persisted integrity hash. Expired evidence is surfaced as `STALE`; it is never promoted to GREEN.

## Audit
Evidence persistence is paired with `public.flix_admin_audit_events`. Audit records retain:
- actor subject/role
- action and capability
- exact SHA and environment
- target and evidence linkage
- correlation ID
- outcome
- metadata
- integrity hash

The linked read model exposes evidence and its latest audit event without creating a second source of truth.

## Provenance
Production-facing assertions require exact SHA, environment, source, evaluator, and freshness. UNKNOWN, STALE, UNAVAILABLE, BLOCKED and FAILED remain non-GREEN states.

## Safety boundary
This phase does not activate:
- `production.write`
- deployment execution
- rollback
- destructive operations
- approval-driven production changes
- controlled AI execution

Implementation is allowed to persist evidence and audit data; production execution remains locked behind later policy/approval/verification contracts.
