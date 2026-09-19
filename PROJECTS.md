# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
SOURCE OF TRUTH = main
ACTIVE REPAIR LANE = execution
CURRENT MAIN SHA = 75a6780f760de6acde2a69affc5104e634667596
ACTIVE PR = #748 (execution → main)
CURRENT PR HEAD = tracked by GitHub PR #748; exact head is authoritative in GitHub
STATE = BLOCKED — fresh verification is required after the current security repair commit
CANONICAL TEST SYSTEM = run 35417501218 PASS on pre-repair execution head; invalidated by this commit and must rerun
CURRENT EXECUTION PRE-REPAIR EVIDENCE = Test System PASS; Test Impact PASS; Claude Security Review PASS
REPOSITORY SECURITY BASELINE = FAIL on pre-repair head because three security-critical workflows used a 39-character upload-artifact SHA
WP0 TRUST BASELINE = FAIL on pre-repair head because the same 39-character action ref prevented runner setup
VERCEL = FAILURE — deployment rate limited on PR #748; external provider state, not a source-code failure
EXACT-SHA GREEN = NOT PROVEN
ADMIN STATES = historical labels below are not current exact-SHA proof; revalidation required after the active repair cycle
PRODUCTION DEPLOYMENT EXACT-SHA = NOT PROVEN IN CURRENT EVIDENCE
NO CLOSED/VERIFIED LABEL IN THIS FILE IS CURRENT GREEN PROOF UNLESS IT IS REPROVEN ON THE ACTIVE MAIN SHA
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
| TEST-001 | CLOSED / VERIFIED | Preserve deterministic ownership registry and validator |
| AGENT-PROTOCOL-003 | CLOSED / VERIFIED | Preserve proof-driven fail-closed repair lifecycle and learning/prevention contracts |
| DEBT-001 | ACTIVE | Harden technical-debt audit evidence; first deliverable is a deterministic validator/regression contract, with no broad deletion |
| TOOL-EXPANSION | CANDIDATE | Activate only after a fresh deterministic scope is proven |

## DEBT-001

```text
ACTIVE
PURPOSE = Harden technical-debt detection into a deterministic, evidence-backed maintenance contract.
ACTIVATED FROM = NEXT-CANDIDATE REVIEW after fresh canonical CI RUN 35124571456 passed on main SHA 594766c220864fcd55fd8cbbcf491fb2a8778dc2.
AUDIT PRODUCER = scripts/ci/audit-technical-debt.mjs
PACKAGE ENTRYPOINT = audit:technical-debt
CURRENT DETECTION SURFACES = orphan tests, legacy-labelled files, unreferenced dependencies, and unproven i18n fallback ownership.
GUARDRAIL = inventory first; no broad deletion, no CI weakening, no certification bypass, no production mutation.
FIRST BOUNDED DELIVERABLE = deterministic validator/regression contract proving audit output schema, SHA binding, finding fingerprints, and evidence completeness.
IMPLEMENTATION STATUS = DELIVERED ON EXECUTION; validator now recomputes finding fingerprints, requires non-empty evidence, and the regression is registered as canonical STATIC-028 / ASSERT-TECHNICAL-DEBT-001.
CURRENT IMPLEMENTATION HEAD = 6b26703cde343c5d95ae8c93627d4c540d3ab783.
VERIFICATION STATUS = PENDING FRESH EXACT-SHA CANONICAL CI.
BOUNDED REPAIR CANDIDATE = FALSE ORPHAN TEST CLASSIFICATION.
REPAIR = audit now recognizes generic Playwright ownership for `tests/*.spec.*` / `tests/*.test.*` under the canonical `testDir: './tests'` configuration; regression proves `tests/foundation.spec.ts` is not reported as orphaned.
LATEST EXECUTION HEAD = 9802b033a346153c12a6182d077991a86af0e0f1.
NEXT EXIT = fresh canonical static/build/browser/certification evidence on this exact head.
SUCCESS GATE = targeted regression + Static/Build + FAST/DEEP + Certification + CI/CD trust + invariant proof + closure evidence.
NEXT GATE = review audit findings after the validator is proven and activate only one bounded repair candidate.
```

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

## TEST-001

```text
CLOSED / VERIFIED
PURPOSE = Deterministic ownership inventory across executable test/verification surfaces
VERIFIED IMPLEMENTATION SHA = 9b41e01e8d7e806b6aebaab14de1255a5e7bc35b
VERIFIED FINAL MAIN SHA = 29ec4d0bb3dcf6b8e430c087597040cc6cac1c28
VERIFIED CI RUN = 35121180929
OWNERSHIP REGISTRY = scripts/ci/test-ownership-map.json
VALIDATOR = scripts/ci/validate-test-ownership.mjs
STATIC + BUILD = PASS
BROWSER FAST = PASS (Chromium / Firefox / WebKit)
BROWSER DEEP = PASS (Chromium / Firefox / WebKit)
CERTIFICATION = PASS
TARGETED REGRESSION = PASS: critical CI/repair verification commands have explicit ownership and infrastructure surfaces are excluded from file-impact routing requirements
INVARIANT PROOF = PASS: ownership registry is unique/non-empty, required npm scripts exist, CI and auto-repair consumers are present, and execution-surface classifications are valid
CLOSURE EVIDENCE = RECORDED
```

## AGENT-PROTOCOL-003

```text
CLOSED / VERIFIED
PURPOSE = Autonomous Repair Protocol v3 with proof-driven, fail-closed lifecycle
VERIFIED IMPLEMENTATION SHA = 6d90158d0dc759517254935e6f45cc82bd70f50f
VERIFIED FINAL MAIN SHA = 29ec4d0bb3dcf6b8e430c087597040cc6cac1c28
VERIFIED CI RUN = 35121180929
LIFECYCLE = FAILURE → EVIDENCE LOCK → FINGERPRINT → RCA → MEMORY RETRIEVAL → RISK GATE → REPAIR PLAN → BOUNDED EXECUTION → TARGETED TEST → FULL REGRESSION → ROOT-CAUSE PROOF → RECURRENCE CHECK → LEARN → PREVENTION RULE → CERTIFY → CLOSE
ROOT-CAUSE PROOF = REQUIRED: failing reproduction + recovered reproduction + regression + required commands
RECURRENCE PROOF = REQUIRED: two post-fix recurrence checks
FAIL-CLOSED = REQUIRED: failed proof triggers rollback and terminal failure evidence
PREVENTION = REQUIRED: successful repair records a prevention rule
BOUNDED EXECUTION = PRESERVED: protected paths, confidence gates, bounded diffs, reproduction, rollback, and evidence remain mandatory
STATIC + BUILD = PASS
BROWSER FAST = PASS (Chromium / Firefox / WebKit)
BROWSER DEEP = PASS (Chromium / Firefox / WebKit)
CERTIFICATION = PASS
CI/CD TRUST CONTRACT = PASS
CERTIFICATION EVIDENCE = flixo-certification-evidence-35121180929
TARGETED REGRESSION = PASS: validator/engine proof contract aligned and canonical CI certification completed
INVARIANT PROOF = PASS: fail-closed proof markers, rollback path, recurrence requirements, and canonical evidence gates were exercised by the certified run
CLOSURE EVIDENCE = RECORDED
```

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update. An externally blocked state is not a VERIFIED closure and cannot unlock dependent production certification tasks.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.

## FRESH CI EVIDENCE RECHECK

```text
REQUEST = validate main-state i18n repair through the canonical FLIXO Test System on a pull-request event
TARGET = Seed UI ownership repair at 40786637552d8c0268fd4b9de579c104f58726ab
NO GATE BYPASS = required
```