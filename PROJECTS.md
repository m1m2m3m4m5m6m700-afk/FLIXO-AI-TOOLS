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
I18N-001 REPAIR = IMPLEMENTED ON MAIN / FRESH CI EVIDENCE REQUIRED
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
| BUILD-002 | ACTIVE | Verify canonical build-identity producer/consumer regression on fresh exact SHA; then close only with full evidence |
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
PURPOSE = Deterministic artifact-graph ownership and identity-contract hardening
ENTRY BASIS = RELEASE-001 closure evidence confirmed on exact SHA 6e338cb3c1f35abe458c3316b5ff036ad8dcc7cb
SCOPE = map build artifacts → producers → consumers → immutable identity checks → deployment/certification evidence
GUARDRAIL = no production deployment behavior bypass; identity guard is fail-closed and must be proven by fresh CI

ARTIFACT OWNERSHIP MAP
PRODUCER = npm run build → vite build + generated robots/sitemap/static route entries → dist/
CANONICAL IDENTITY PRODUCER = scripts/ci/runtime/build-identity.mjs → dist/__flixo/build-identity.json + dist/__flixo/artifact-hash.txt
PRIMARY CI CONSUMER = FLIXO Test System Static + Build → invokes canonical producer and verifies its manifest against EXPECTED_SHA
BROWSER CONSUMERS = Browser FAST/DEEP download flixo-build-${RUN_ID} and re-verify canonical identity + SHA + package-lock hash
CERTIFICATION CONSUMER = execution-graph.json + primary browser evidence files → canonical certification engine
DEPLOYMENT CONSUMER = FLIXO Continuous Delivery downloads flixo-build-${CI_RUN_ID} and fail-closes unless canonical identity commitSha == promotion SHA

IMPLEMENTED CHANGE = canonical producer is now executed after build; its identity manifest is embedded in the immutable dist artifact; CI and CD consume the same producer-owned manifest.
REGRESSION = scripts/ci/test-build-identity-contract.mjs is wired into npm test:static and proves producer invocation, producer-owned manifest, immutable artifact publication, and CD consumption.
STATUS = IMPLEMENTED / AWAITING FRESH CANONICAL CI EVIDENCE
CURRENT IMPLEMENTATION SHA = e927e76f814bb364eb3381c7bac37c7be73bb143
CI RUN = 35107013374 (pending at last observation)
CLOSURE RULE = do not mark BUILD-002 CLOSED until fresh exact-SHA Static + Build, Browser FAST/DEEP, Certification, and invariant evidence all pass.
```

## I18N-001 REPAIR EVIDENCE

```text
SCOPE = Seed tool runtime UI string ownership
REPAIR = remove local DEFAULT_SEED_UI fallback ownership and consume canonical EN_SEED_UI from src/lib/i18n/locales/en.ts
REPAIR SHA = 40786637552d8c0268fd4b9de579c104f58726ab
CURRENT MAIN CONTAINS REPAIR = YES
FRESH CI = REQUIRED; bot-authored push did not create the canonical test-system run
STATUS = EVIDENCE PENDING
```

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update. An externally blocked state is not a VERIFIED closure and cannot unlock dependent production certification tasks.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
