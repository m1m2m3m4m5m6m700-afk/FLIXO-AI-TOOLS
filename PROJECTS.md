# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
CURRENT MAIN SHA = AUTHORITATIVE BRANCH REF
ACTIVE TASK = TEST-001 → ACTIVE
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-005 = CLOSED / VERIFIED
ADMIN-006 = CLOSED / VERIFIED
ADMIN-007 = CLOSED / VERIFIED
ADMIN-008 = CLOSED / VERIFIED
RELEASE-001 = CLOSED / VERIFIED
I18N-001 = CLOSED / VERIFIED
BUILD-002 = CLOSED / VERIFIED
SUPABASE PROJECT = zrpsmgdrtwzrhkjwwujo / ACTIVE_HEALTHY
VERCEL PRODUCTION BINDING = EXACT-SHA PRODUCTION IDENTITY PROVEN
PRODUCTION MUTATION = DISABLED
I18N-001 REPAIR = VERIFIED ON MAIN / FRESH CANONICAL CI PASS
BUILD-002 = VERIFIED ON MAIN / FRESH CANONICAL CI PASS
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | CLOSED / VERIFIED | Preserve fail-closed execution boundary |
| ADMIN-005 | CLOSED / VERIFIED | Preserve verified server boundary and browser-bundle security invariant |
| ADMIN-006 | CLOSED / VERIFIED | Preserve persistence evidence and exact-SHA roundtrip proof |
| ADMIN-007 | CLOSED / VERIFIED | Preserve capability contract and server-boundary proof |
| ADMIN-008 | CLOSED / VERIFIED | Preserve final production certification and evidence |
| RELEASE-001 | CLOSED / VERIFIED | Preserve exact release evidence and do not reopen without a new deterministic blocker |
| I18N-001 | CLOSED / VERIFIED | Preserve canonical Seed UI ownership and regression proof |
| BUILD-002 | CLOSED / VERIFIED | Preserve canonical artifact identity producer/consumer contract |
| TEST-001 | ACTIVE | Ownership inventory; bounded deterministic scope only |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN ENTRY — FIVE-CLICK LOGO

```text
IMPLEMENTED ON MAIN
ACTION = five consecutive clicks on the FLIXO logo within the gesture window
TARGET ROUTE = /admin
AUTHENTICATION = unchanged; the gesture is navigation only and does not bypass admin authorization
```

## ADMIN-008

```text
CLOSED / VERIFIED
PURPOSE = Final production certification
VERIFIED EXACT SHA = d4a16b2a04df9688c5833a5b15c9277d4f16c005
VERIFIED CD RUN = 35020415643
PROMOTION SHA RESOLUTION = PASS
CURRENT MAIN PROOF AT DEPLOYMENT = PASS
CERTIFIED CI RESOLUTION = PASS
CERTIFIED BUILD ARTIFACT = PASS
IMMUTABLE VERCEL DEPLOYMENT = PASS
PRODUCTION IDENTITY READ-BACK = PASS
DEPLOYMENT EVIDENCE UPLOAD = PASS
```

## RELEASE-001

```text
CLOSED / VERIFIED
PURPOSE = Final deterministic gate before public production release
VERIFIED EXACT SHA = 6e338cb3c1f35abe458c3316b5ff036ad8dcc7cb
VERIFIED CI RUN = 35065020358
STATIC + BUILD = PASS
BROWSER FAST = PASS (Chromium / Firefox / WebKit)
BROWSER DEEP = PASS (Chromium / Firefox / WebKit)
CERTIFICATION = PASS
CERTIFICATION EVIDENCE = flixo-certification-evidence-35065020358
TARGETED REGRESSION = PASS via complete static/build + FAST/DEEP browser matrix and certification execution graph
INVARIANT PROOF = PASS via immutable artifact verification, exact-SHA identity checks, execution-graph completeness, and CI/CD trust validation
CLOSURE EVIDENCE = RECORDED
```

## I18N-001

```text
CLOSED / VERIFIED
PURPOSE = Runtime locale ownership and UI-string ownership hardening
VERIFIED EXACT MAIN SHA = 92862289b4fab234a8eea1595ca4bb8f644d7a4c
VERIFIED CI RUN = 35113721226
REPAIR SHA = 40786637552d8c0268fd4b9de579c104f58726ab
REPAIR = removed local DEFAULT_SEED_UI fallback ownership and consumed canonical EN_SEED_UI from src/lib/i18n/locales/en.ts
TARGETED REGRESSION = PASS via fresh canonical FLIXO Test System run
INVARIANT PROOF = PASS: Seed UI ownership is canonical and the local duplicate fallback is absent on main
CLOSURE EVIDENCE = RECORDED
```

## BUILD-002

```text
CLOSED / VERIFIED
PURPOSE = Deterministic artifact-graph ownership and identity-contract hardening
VERIFIED EXACT MAIN SHA = 92862289b4fab234a8eea1595ca4bb8f644d7a4c
VERIFIED CI RUN = 35113721226
IMPLEMENTATION SHA = e927e76f814bb364eb3381c7bac37c7be73bb143
CANONICAL IDENTITY PRODUCER = scripts/ci/runtime/build-identity.mjs
STATIC + BUILD = PASS
BROWSER FAST = PASS (Chromium / Firefox / WebKit)
BROWSER DEEP = PASS (Chromium / Firefox / WebKit)
CERTIFICATION = PASS
CI/CD TRUST CONTRACT = PASS
IMMUTABLE BUILD ARTIFACT = PASS (flixo-build-35113721226)
CERTIFICATION EVIDENCE = flixo-certification-evidence-35113721226
TARGETED REGRESSION = PASS: canonical producer invocation, producer-owned identity manifest, immutable artifact publication, browser re-verification, and certification graph completeness
INVARIANT PROOF = PASS: execution SHA, canonical build identity, package-lock checksum, browser artifact verification, and certification trust checks all passed on main
CLOSURE EVIDENCE = RECORDED
```

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update. An externally blocked state is not a VERIFIED closure and cannot unlock dependent production certification tasks.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
