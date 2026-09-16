# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
CURRENT MAIN SHA = AUTHORITATIVE BRANCH REF
ACTIVE TASK = BUILD-002 → ACTIVE
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-005 = CLOSED / VERIFIED
ADMIN-006 = CLOSED / VERIFIED
ADMIN-007 = CLOSED / VERIFIED
ADMIN-008 = CLOSED / VERIFIED
RELEASE-001 = CLOSED / VERIFIED
SUPABASE PROJECT = zrpsmgdrtwzrhkjwwujo / ACTIVE_HEALTHY
VERCEL PRODUCTION BINDING = EXACT-SHA PRODUCTION IDENTITY PROVEN
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
| ADMIN-008 | CLOSED / VERIFIED | Preserve final production certification and evidence |
| RELEASE-001 | CLOSED / VERIFIED | Preserve exact release evidence and do not reopen without a new deterministic blocker |
| BUILD-002 | ACTIVE | Fresh artifact-graph analysis; identify build artifact ownership, identity, and regression boundaries |
| I18N-001 | CANDIDATE | Runtime ownership trace |
| TEST-001 | CANDIDATE | Ownership inventory |
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

## BUILD-002

```text
ACTIVE
PURPOSE = Deterministic artifact-graph analysis after release certification
ENTRY BASIS = RELEASE-001 closure evidence confirmed on exact SHA 6e338cb3c1f35abe458c3316b5ff036ad8dcc7cb
SCOPE = map build artifacts → producers → consumers → immutable identity checks → deployment/certification evidence
GUARDRAIL = no production mutation; analysis and bounded fixes only
```

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update. An externally blocked state is not a VERIFIED closure and cannot unlock dependent production certification tasks.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
