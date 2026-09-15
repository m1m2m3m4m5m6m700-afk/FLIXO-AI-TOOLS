# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
CURRENT MAIN SHA = RESOLVE FROM main AT EXECUTION TIME (never store a self-referential SHA here)
ACTIVE TASK = ADMIN-006 → ACTIVE / BLOCKED BY PRODUCTION WRITE → READ-BACK PROOF
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-005 = CLOSED / VERIFIED
ADMIN-006 CONTRACT = docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md
ADMIN-006 PROVENANCE = docs/ADMIN-PERSISTENCE-PROVENANCE.md
SUPABASE PROJECT = zrpsmgdrtwzrhkjwwujo / ACTIVE_HEALTHY
VERCEL PRODUCTION BINDING = EXACT-SHA IDENTITY CHECK IMPLEMENTED / WRITE → READ-BACK NOT PROVEN
PRODUCTION MUTATION = DISABLED
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | CLOSED / VERIFIED | Preserve fail-closed execution boundary |
| ADMIN-005 | CLOSED / VERIFIED | Preserve verified server boundary and browser-bundle security invariant |
| ADMIN-006 | ACTIVE / BLOCKED | Complete authoritative production server write → read-back proof without enabling uncontrolled production mutation |
| ADMIN-007 | LOCKED | Activate after ADMIN-006 |
| ADMIN-008 | LOCKED | Final production certification |
| BUILD-002 | CANDIDATE | Fresh artifact graph analysis |
| I18N-001 | CANDIDATE | Runtime ownership trace |
| TEST-001 | CANDIDATE | Ownership inventory |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN-006

```text
ACTIVE / BLOCKED BY PRODUCTION WRITE → READ-BACK PROOF
Contract = docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md
Contract version = v1.0
Provenance = docs/ADMIN-PERSISTENCE-PROVENANCE.md
Supabase project ref = zrpsmgdrtwzrhkjwwujo
Supabase status = ACTIVE_HEALTHY
Existing tables = public.flix_events, public.flix_admin_sessions
Admin substrate = public.flix_admin_evidence, public.flix_admin_audit_events
Migration = supabase/migrations/20260914040000_admin_006_persistence_evidence.sql
Server adapter = api/admin/persistence.ts
Targeted regression = scripts/test-admin-persistence.mjs
Integrity regression = scripts/test-admin-integrity-readback.mjs
Production verifier = scripts/verify-admin-production-readback.mjs
Production verifier command = verify:admin-production-readback
Vercel documented project = prj_FdFbUWMAZepEfvwhttAiLcYJqY0d
CURRENT MAIN = RESOLVE FROM main AT EXECUTION TIME
Production exact-SHA identity = VERIFIED / dedicated non-mutating verifier implemented
Production server write → read-back = NOT PROVEN
```

The Phase 2 persistence/evidence substrate and deterministic production identity verifier are implemented. The verifier is non-mutating and checks the production origin against an exact expected SHA plus HTML response. This is supporting deployment evidence only; it does not substitute for the contract's authoritative production server write → read-back proof.

Production mutation remains disabled. External provider quota/access failures must remain explicit blockers and must never be converted into GREEN.

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
