# ADMIN-006 — Phase 2 Real Persistence and Evidence Contract

Status: AUTHORIZED / ACTIVE
Contract version: v1.0
Source of authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`
Baseline: `main @ 71cdd5843da871db47c1fa91eb169ee4ac935b5d`

## Scope

ADMIN-006 is limited to Phase 2 — Real Persistence and Evidence for the Admin Control Plane.

The implementation must use one proven persistence path and must not introduce a parallel store without evidence of need.

## Required deliverables

1. Admin principals/roles/capabilities as needed by the existing server boundary.
2. Audit events.
3. Evidence records.
4. Operational read models/adapters.
5. Retention rules.
6. Integrity/provenance fields.

## Required evidence model

Every production-facing Admin claim must carry:
- `assertionId` or `claimId`
- exact SHA or authoritative version identifier
- source
- evaluator/check
- environment
- `evidenceId`
- timestamp
- status/verdict
- freshness/age

Allowed truth states:
`VERIFIED`, `FAILED`, `BLOCKED`, `UNAVAILABLE`, `STALE`, `UNKNOWN`.

`UNKNOWN`, `STALE`, and `UNAVAILABLE` must never be converted into GREEN.

## Required exit proof

ADMIN-006 may close only when all of the following are proven on one exact main SHA:

- write/read-back proof
- actor and exact target provenance
- audit completeness
- no fake metrics
- exact-SHA evidence is current
- targeted negative/positive tests pass
- required CI/certification passes
- no dependent repair remains open
- `PROJECTS.md` and `المهام.md` are updated with closure evidence

## Safety boundaries

- Production mutation remains disabled unless a later authoritative task explicitly activates it.
- No LLM-direct execution.
- No duplicate database/persistence stack without evidence.
- No fake production truth or metrics.
- No authorization bypass.
- Fail-closed behavior remains mandatory.

## Explicit exclusions

This contract does not activate:
- controlled production execution
- destructive operations
- approval workflow implementation
- Truth Center implementation beyond the persistence/evidence substrate
- Truth Graph
- Controlled AI execution

Those remain separately locked phases/tasks in the master roadmap.
