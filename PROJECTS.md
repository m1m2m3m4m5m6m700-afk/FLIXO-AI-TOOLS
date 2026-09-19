# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
SOURCE OF TRUTH = main
ACTIVE REPAIR LANE = execution
CURRENT MAIN SHA = 5115ac0528a7b18ae9ae3d392ccbfd2257900ea3
ACTIVE PR = #750 OPEN / execution → main
CURRENT PR HEAD = authoritative GitHub PR #750 head; do not duplicate a mutable SHA in this map
STATE = BLOCKED_EXTERNAL
CANONICAL TEST SYSTEM = FRESH EVIDENCE REQUIRED AFTER c2640bad; prior exact-head evidence is stale for current execution
CURRENT EXECUTION PRE-REPAIR EVIDENCE = Test System PASS; Test Impact PASS; Claude Security Review PASS
REPOSITORY SECURITY = FAIL on exact head: GitHub Advanced Security Code Scanning AI returned CAPI 400 model-not-supported
WP0 TRUST BASELINE = CURRENT-HEAD VERIFICATION REQUIRED
VERCEL = BLOCKED_EXTERNAL: provider deployment rate-limit
EXACT-SHA GREEN = NOT PROVEN
ADMIN STATES = historical labels below are not current exact-SHA proof; revalidation required after the active repair cycle
PRODUCTION DEPLOYMENT EXACT-SHA = NOT PROVEN IN CURRENT EVIDENCE
POST-MERGE MAIN SHA VERIFIED = 5115ac0528a7b18ae9ae3d392ccbfd2257900ea3
POST-MERGE CI / CERTIFICATION = PENDING FRESH EVIDENCE
NO CLOSED/VERIFIED LABEL IN THIS FILE IS CURRENT GREEN PROOF UNLESS IT IS REPROVEN ON THE ACTIVE MAIN SHA
```


## LIVE DISCOVERY SYNC — 2026-09-19

```text
TASK LEDGER = المهام.md §15.0 LIVE DISCOVERY OVERLAY
CURRENT EXECUTION SHA = authoritative GitHub execution branch ref; do not duplicate a mutable SHA in this map
OPEN PR = #750 → main
DEPENDENT PR = #752 → execution, stale/conflicting base
LIVE EXTERNAL BLOCKERS = GitHub Advanced Security model rejection + Vercel deployment rate-limit
LIVE AUTOMATION RCA = continuous-error-watch input artifact missing on main automation cycle
ADMIN PROVENANCE = production Vercel→Supabase binding not proven
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
| DEBT-001 | BLOCKED_EXTERNAL | Deterministic validator delivered; required exact-head external security/Vercel gates are unresolved |
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
CURRENT IMPLEMENTATION HEAD = 3b056c33b7d7a84ac8ae6231959a67f9d304f3b5.
VERIFICATION STATUS = BLOCKED_EXTERNAL; required external security/Vercel gates are unresolved.
BOUNDED REPAIR CANDIDATE = FALSE ORPHAN TEST CLASSIFICATION.
REPAIR = audit recognizes generic Playwright ownership for `tests/*.spec.*` / `tests/*.test.*` under canonical `testDir: './tests'`, and excludes `artifacts/`, `diagnostics/`, and `docs/` from legacy deletion candidates so historical evidence is preserved.
REGRESSION = `tests/foundation.spec.ts` must not be orphaned; `artifacts/ci/legacy-inventory.json` must not be a deletion candidate.
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

## EXECUTION LEARNING

```text
RC-023 = Technical-debt dependency audit used GNU grep -E with an unsupported PCRE non-capturing group and swallowed parser errors, producing false unreferenced-dependency evidence.
FIX = 8c90d429bb7ecf41ac578a841f4ec3282476aed1
VERIFIED = CI RUN 35422251044 on exact SHA 8c90d429; stale for closure after execution advanced to 738676c.
PREVENTION = fail closed on grep/tool errors other than exit status 1, use POSIX ERE, scope usage evidence to source files, and assert producer stderr is empty.

RC-024 = GitHub Advanced Security Code Scanning AI repeatedly rejected the configured Copilot model with CAPI 400 "The requested model is not supported".
EVIDENCE = runs 35422058941, 35422055397, 35422052291, 35422047947, 35422635168, and current check on execution 738676c.
STATUS = BLOCKED_EXTERNAL.
PREVENTION = classify provider model rejection as external infrastructure; do not mutate source code, weaken required checks, bypass certification, or rerun blindly.
```

RC-027 = Canonical CI contract validator contained a no-useless-escape lint error in its regex literal; repaired without changing contract semantics.
VERIFICATION = WP0 + Canonical CI on the resulting exact SHA.

RC-028 = TanStack Router typed route literal mismatch in `src/routes/tools-page.tsx`: `/ar/` was not a registered route literal; exact-head WP0 typecheck rejected it.
FIX = normalize the navigation links to the registered `/ar` route literal.
VERIFICATION = `npm run typecheck` + router contract on the new exact SHA.
PREVENTION = route links must use generated TanStack route literals or route templates/params, not hand-authored trailing-slash variants.

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

## INCOMPLETE PROJECT COVERAGE — synchronized with the unified task ledger

> Source set: current `المهام.md`, legacy `مهام.md`, `docs/DEBT-REGISTER.md`, Agent Knowledge Architecture, and active repair/security workflows. Historical-only records are excluded from the active queue.

| ID | Status | Owner/Surface | Next deterministic action |
|---|---|---|---|
| AUTO-REPAIR-BOT-001 | ACTIVE / LEDGER-MISSING | Auto Repair + Task Agent + Error Agent | Register lifecycle, prove repair publication and learning gates on current SHA |
| EXECUTION-BOT-WATCHDOG-001 | ACTIVE | execution-bot-watchdog | Verify exact-SHA RED detection and canonical repair dispatch |
| REPAIR-SUPERVISION-GATES-001 | ACTIVE | handoff/recovery/merge gates | Prove fail-closed handoff→merge chain |
| ROOT-CAUSE-DIAGNOSTICS-001 | OPEN | diagnostics/scout/investigator | Unify evidence→fingerprint→RCA path |
| WP1-REGISTRY-ENGINE-001 | INCOMPLETE / PARTIAL | Registry/Planner/Executor/Verifier | Finish loader/discovery/contracts |
| WP2-SECURITY-OBSERVABILITY-001 | OPEN | security/tracing/error classification | Close security + observability invariants |
| WP3-UNDERSTAND-PLAN-CONFIRM-001 | OPEN | intent/planner/confirmation | Complete lifecycle contracts |
| WP4-EXECUTE-VERIFY-RECOVER-001 | OPEN | executor/verifier/recovery/memory | Complete output + recovery contracts |
| WP5-CONTRACT-E2E-ADVERSARIAL-001 | OPEN | tests/impact/adversarial | Complete reusable E2E and negative coverage |
| WP6-PERFORMANCE-LOCAL-FIRST-001 | OPEN | performance/deps/local-first | Complete profiling and performance contracts |
| WP7-SEO-I18N-RELEASE-001 | OPEN | SEO/i18n/release | Complete SEO-A..F + release gate |
| AGENT-KNOWLEDGE-000..013 | VERIFICATION-PENDING / PLANNED | embedded agent knowledge | Reconcile existing implementation then execute remaining sessions |
| D-001..D-012 | OPEN / LINKED | technical-debt register | Close through owning WP or GREEN recovery |
| FIX-001 | BLOCKED_EXTERNAL / OPEN | GitHub branch protection | Apply with authorized integration, then re-verify |
| PERFORMANCE-BUNDLE-001 | OPEN | bundle-boundary contract | Prove chunk/budget invariants |
| ACCEL-1..9 | FROZEN | CI speed work | Remain frozen until explicitly reactivated |
| RELEASE-FINALIZATION-001 | PLANNED | release/finalization | Require complete exact-SHA release evidence |

## PROJECT MAP RULE

Every material workflow/project must map to one task ID in `المهام.md`. No orphan operational system is considered complete until its owning task has an exit criterion and fresh evidence.


## SIMPLIFY-001 — Engineering Complexity Reduction

STATUS = VERIFYING / BLOCKING
BASE = 50e6a19f8faaabf958d0bdc5309ab3c8e4019fb7
COMPLETED = canonical task-ledger selection, command facade, CI ownership consolidation, single certification authority enforcement, dead-code proof, and bounded boundary cleanup.
REMOVED = validate-certification-graph.mjs alias; verify:contracts duplicate package command; redundant execution-branch push triggers from canonical verification and security workflows.
PRESERVED = security, coverage, artifact identity, exact-SHA, WP0 trust, browser FAST/DEEP, certification, and frozen ACCEL constraints.
NEXT = fresh Canonical CI → WP0/Security → FAST/DEEP → Certification → exact-SHA verification → main merge.
CONSTRAINTS = ACCEL FROZEN; zero coverage/security reduction; execution → main only.
