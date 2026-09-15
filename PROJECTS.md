# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
CURRENT MAIN SHA = 7aafeefb216cd12054b7243ea0a51b6a426ab8f4
ACTIVE TASK = ADMIN-008 → ACTIVE
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-005 = CLOSED / VERIFIED
ADMIN-006 = CLOSED / VERIFIED
ADMIN-007 = CLOSED / VERIFIED
ADMIN-008 = ACTIVE
RELEASE-001 = LOCKED
SUPABASE PROJECT = zrpsmgdrtwzrhkjwwujo / ACTIVE_HEALTHY
VERCEL PRODUCTION BINDING = EXACT-SHA IDENTITY CHECK IMPLEMENTED / PRODUCTION DEPLOYMENT QUOTA BLOCKER REMAINS
PRODUCTION MUTATION = DISABLED
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | CLOSED / VERIFIED | Preserve fail-closed execution boundary |
| ADMIN-005 | CLOSED / VERIFIED | Preserve verified server boundary and browser-bundle security invariant |
| ADMIN-006 | CLOSED / VERIFIED | Preserve persistence evidence and exact-SHA roundtrip proof |
| ADMIN-007 | CLOSED / VERIFIED | Preserve capability contract and server-boundary proof |
| ADMIN-008 | ACTIVE | Final production certification and exact-SHA release evidence |
| RELEASE-001 | LOCKED | Activate after ADMIN-008 VERIFIED plus fresh required release evidence |
| BUILD-002 | CANDIDATE | Fresh artifact graph analysis |
| I18N-001 | CANDIDATE | Runtime ownership trace |
| TEST-001 | CANDIDATE | Ownership inventory |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN-006

```text
CLOSED / VERIFIED
Contract = docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md
Contract version = v1.0
Provenance = docs/ADMIN-PERSISTENCE-PROVENANCE.md
Supabase project ref = zrpsmgdrtwzrhkjwwujo
Verified run = 35008306580
Verified exact SHA = a781a13df779a7d1d79e23471d5fc5d93ea71db7
Verified artifact = admin-006-persistence-evidence-35008306580
Real non-production write → read-back = VERIFIED
Production mutation = DISABLED
```

## ADMIN-007

```text
CLOSED / VERIFIED
PURPOSE = Capability contract and server-boundary enforcement
IMPLEMENTATION = PR #701
MERGED MAIN SHA = 7aafeefb216cd12054b7243ea0a51b6a426ab8f4
CAPABILITY CONTRACT = docs/contracts/ADMIN-CAPABILITY-CATALOG-CONTRACT.md
SERVER BOUNDARY = api/admin/boundary.ts
TARGETED REGRESSION = scripts/test-admin-server-boundary.mjs
REQUIRED BEHAVIOR = unauthorized/missing capability fail closed; authorized capability path remains bounded
FULL CI RUN = 35016774798 (#6610)
FULL CI SHA = d97c13e5b12b3d1b3eb18c2f7ff8dccb8dc34310
FULL CI RESULT = GREEN across Static + Build, Browser FAST, Browser DEEP, Certification, execution-graph completeness, fail-closed decision and CI/CD Trust Layer
PRODUCTION MUTATION = DISABLED
```

### Closure evidence

```text
ADMIN-007 closure conditions satisfied.
MERGED TO MAIN = YES
EXACT MAIN SHA AT CLOSURE = 7aafeefb216cd12054b7243ea0a51b6a426ab8f4
TARGETED SERVER-BOUNDARY REGRESSION = INCLUDED IN CERTIFICATION SURFACE
FULL CI = 35016774798
CERTIFICATION = SUCCESS
EXECUTION GRAPH COMPLETENESS = SUCCESS
FAIL-CLOSED DECISION = SUCCESS
CI/CD TRUST LAYER = SUCCESS
```

## ADMIN-008

```text
ACTIVE
PURPOSE = Final production certification
ACTIVATION = ADMIN-007 VERIFIED
PRODUCTION MUTATION = DISABLED UNTIL EXPLICIT RELEASE GATE
REQUIRED = exact-SHA production identity, security/configuration proof, product/routing/i18n proof, SEO/performance proof, observability/error-memory proof, rollback reference, and final certification evidence
```

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update. An externally blocked state is not a VERIFIED closure and cannot unlock dependent production certification tasks.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
