# P00 — SUPREME FIRST OBLIGATION

Before any repository, project or cell action, every Master/Agent/Bot MUST admit:
RPR-UNIFIED-EXECUTION-001 v4.0.0 → docs/agents/PROMPT-UNIFIED-EXECUTION.md.

P00 is the first execution obligation for MASTER-1/2/3 and all agents/bots. It controls zero-error circular execution, shared-cell coordination, Exact-SHA evidence, root-cause repair, liveness and hard exit. The machine-enforced source is the protocol registry + control plane + validators + exit lock.

## UNIFIED PROMPT — CANONICAL EXECUTION SURFACE

The repository has exactly one active execution protocol/prompt:
RPR-UNIFIED-EXECUTION-001 v4.0.0 → docs/agents/PROMPT-UNIFIED-EXECUTION.md.

It absorbs orchestration, causal repair, task preparation, contract-drift, external classification, product/platform implementation, Action Vault learning, Exact-SHA verification, Council coordination and circular GREEN-closure intent.

The canonical prompt source is docs/agents/PROMPT-UNIFIED-EXECUTION.md. src/lib/agent/flixo-agent-master-prompt.ts is only the customer-runtime adapter and does not contain a second instruction source.

## Administrative Messages — Communication System
**«رسائل الإدارة» = Canonical Agent Communication.** This is the existing internal communication system between the Council, Masters, supervisors, and agents. It is a naming alias only; no parallel channel or registry is created. Council administrative messages remain P0.

## Agent Communication Priority

Communication-fi

## GREEN-RECOVERY-001 — VERIFIED EVIDENCE / CLOSURE PENDING CURRENT SHA

- Exact SHA: `c5fcf7be89cb7f4a3a56a4fce91f0853d523e5ce`
- Historical verification on c5fcf7be: PASS
- Current execution SHA must re-certify before closure
- Internal RED currently tracked by GREEN-RECOVERY-001 task gate
- External blocker: Vercel deployment rate-limit (`BLOCKED_EXTERNAL`), not masked.
rst is a P0 execution invariant. The canonical ingress is Master Inbox Issue #761, the event-driven relay is `.github/workflows/agent-communication-relay.yml`, and the runtime is `scripts/ci/agent-communication.mjs` consumed by `agent-session` and `agent-coordination`. This must remain within the existing agent control plane; no parallel registry/protocol is permitted.

# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation.

`المهام.md` is the canonical task ledger and the mandatory open-task gateway. Any task/status table in this file is a read-only projection and must not be treated as a second task authority.

## CURRENT STATE

```text
SOURCE OF TRUTH = main
ACTIVE REPAIR LANE = execution
CURRENT MAIN SHA = authoritative GitHub main ref; never duplicate a mutable SHA in this map
ACTIVE PR = #782 OPEN / execution → main (current verification/repair lane); prior PRs are historical only
CURRENT PR HEAD = authoritative GitHub PR #782 head; do not duplicate a mutable SHA in this map
NO-NEW-BRANCH = ABSOLUTE; only execution and main are active agent branches; existing historical branches are not valid work paths
STATE = BLOCKED_EXTERNAL
CANONICAL TEST SYSTEM = FRESH EVIDENCE REQUIRED ON CURRENT MAIN/EXECUTION HEAD; prior exact-head evidence is stale
CURRENT EXECUTION PRE-REPAIR EVIDENCE = historical only; fresh exact-head evidence is required for the active execution head
REPOSITORY SECURITY = fresh exact-head verification required; last recorded GHAS CAPI 400 model-not-supported remains classified as BLOCKED_EXTERNAL until fresh provider evidence changes the signature
WP0 TRUST BASELINE = CURRENT-HEAD VERIFICATION REQUIRED
VERCEL = BLOCKED_EXTERNAL: provider deployment rate-limit
EXACT-SHA GREEN = NOT PROVEN; prompt-intelligence verification is pending on the current canonical SHA
ADMIN STATES = historical labels below are not current exact-SHA proof; revalidation required after the active repair cycle
PRODUCTION DEPLOYMENT EXACT-SHA = NOT PROVEN IN CURRENT EVIDENCE
POST-MERGE MAIN SHA VERIFIED = historical 5115ac0528a7b18ae9ae3d392ccbfd2257900ea3; not current GREEN proof
POST-MERGE CI / CERTIFICATION = PENDING FRESH EVIDENCE
NO CLOSED/VERIFIED LABEL IN THIS FILE IS CURRENT GREEN PROOF UNLESS IT IS REPROVEN ON THE ACTIVE MAIN SHA
```


## ACTIVE LATEST-COMMIT-ONLY TEST GOVERNANCE

- TEST-HEAD-ONLY-001 = IMPLEMENTED / VERIFYING
- Rule: every execution push/synchronize supersedes older test/verification runs; only newest exact branch head may produce current evidence.
- Controller: `.github/workflows/latest-commit-test-supersession.yml`
- Enforcement: per-workflow `cancel-in-progress: true` + `assert-current-commit.mjs` stale guard + `scripts/ci/test-latest-commit-only.mjs`.

## ACTIVE ACTION VAULT TRIAD GOVERNANCE

- VAULT-TRIAD-001 = IMPLEMENTED / VERIFICATION PENDING
- Scope: three-resident shared intelligence; VAULT-1/2 programmer parity with opposed proof objectives; VAULT-3 catalog curator/supervisor after 20 unresolved occurrences.
- Machine contract: `docs/agents/ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-PROTOCOL.md` + `scripts/ci/action-vault-triad-governor.mjs`.
- Exact-SHA proof and canonical GREEN remain mandatory.

## LIVE DISCOVERY SYNC — 2026-09-19

```text
TASK LEDGER = المهام.md §15.0 LIVE DISCOVERY OVERLAY
CURRENT EXECUTION SHA = authoritative GitHub execution branch ref; do not duplicate a mutable SHA in this map
OPEN PR = #774 → main; #759 is historical/merged
DEPENDENT PR = none; prior non-canonical PRs are historical and not active work paths
LIVE EXTERNAL BLOCKERS = GitHub/Copilot model rejection + Vercel deployment rate-limit
LIVE AUTOMATION RCA = continuous-error-watch input artifact missing on main automation cycle
ADMIN PROVENANCE = production Vercel→Supabase binding not proven
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-CONTROL-PLANE-REAL-001 | IN_PROGRESS / PARTIAL | Real login/session boundary now implemented on execution; continue production identity, revocation, adapters, evidence, approval, controlled execution, and certification |
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
| CELL-EXEC-GOV-001 | IMPLEMENTED / VERIFICATION PENDING | Run current governance regression, then certify current execution head as required |
| AGENT-PROMPT-INTEL-001 | CONSOLIDATED / VERIFICATION PENDING | Shared Prompt Registry + causal deduplication + quality gate + Task Agent prompt provenance | Run current main canonical static/contract verification; reconcile execution exact-SHA before promotion |
| DEBT-001 | BLOCKED_EXTERNAL | Deterministic validator delivered; required exact-head external security/Vercel gates are unresolved |
| TOOL-EXPANSION | CANDIDATE | Activate only after a fresh deterministic scope is proven |

## CELL-EXEC-GOV-001

```text
STATUS = IMPLEMENTED / VERIFICATION PENDING
CANONICAL POLICY = docs/agents/CELL-EXECUTIVE-OPERATING-POLICY.md
CONTRACT ID = CELL-EXEC-GOV-001
ABSORBED PROTOCOLS = P20 + P21
SCOPE = MASTER-1/2/3 + CELL-001..CELL-200
REPAIR = CONTINUOUS_WHEN_RED
DEVELOPMENT_LEARNING = CONTINUOUS_ON_DISJOINT_SCOPE
RANK = #1..#200 VERIFIED PERFORMANCE ONLY
ESCALATION = L0..L7
NEXT EXIT = fresh exact-SHA governance regression + canonical CI evidence
```

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

## ADMIN-CONTROL-PLANE-REAL-001

```text
STATUS = IN_PROGRESS / PARTIAL
CURRENT IMPLEMENTATION = execution branch only
IMPLEMENTED = server credential verification, signed HttpOnly session, login/logout/session API, protected /admin login surface, session-aware Control Plane, auth regression contract
NOT CERTIFIED = current execution head has no fresh exact-SHA certification for this follow-on change
REMAINING = production identity provenance, durable session revocation, authoritative adapters/evidence, approval + controlled execution, rollback proof, browser/security/certification
LEGACY RULE = retired Admin graph is not restored; control-plane login uses a new route filename while retaining /admin/login URL
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

## AGENT-PROMPT-INTEL-001

STATUS = IMPLEMENTED / VERIFICATION PENDING
PURPOSE = Build one shared Prompt Intelligence Layer over Error Detection → Fingerprint → RCA → Memory → Strategy → Repair → Verification → Learning without creating a second agent registry or repair engine.
CANONICAL REGISTRY = docs/agents/PROMPT-REGISTRY.json
VALIDATOR ENTRYPOINT = scripts/ci/validate-prompt-registry.mjs
REGISTRY ENGINE = scripts/ci/prompt-registry.mjs
ACTIVE PROMPTS = RPR-MASTER-EXECUTION-001, RPR-ERROR-REPAIR-001, RPR-FLIXO-PRODUCT-001; canonical text lives in docs/agents/PROMPT-01-MASTER-EXECUTION.md, docs/agents/PROMPT-02-ERROR-REPAIR.md, docs/agents/PROMPT-03-FLIXO-PRODUCT.md
LEARNING PROVENANCE = promptId + promptVersion + masterPromptId + promptDecision + promptRegistrySha
EXACT-SHA = prompt selection is bound to the active repair target SHA; Prompt text never grants authority.
DUPLICATION RULE = compare failureClasses + rootCauses + scope + repairStrategy + verificationPlan; hard duplicates cannot be ACTIVE together.
QUALITY GATE = duplicate + fingerprint + RCA + scope + safety + verification + learning + provenance + exact-SHA + overlap.
CURRENT BLOCKER = fresh exact-SHA Prompt Registry/contract verification is still pending on the active execution head; main remains on the legacy schema until canonical promotion.
NEXT ACTION = validate Prompt Registry + targeted prompt tests on the current execution SHA, then run canonical CI and exact-SHA certification evidence.

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

RC-030 = Canonical CI contract validator falsely rejected Daily Green Gate evidence handling because its multiline regex joined an `gh run view --log-failed` command to an unrelated intentional `|| true` on a later `gh run list` command.
FIX = scope the forbidden pattern to individual command lines.
VERIFICATION = fresh WP0 canonical static run on the resulting exact SHA.
PREVENTION = never use cross-command multiline regexes for shell safety assertions when command-local matching is sufficient.

RC-031 = `validate-agent-protocol.mjs` asserted an obsolete auto-repair reproduction marker after the engine refactored reproduction ownership to `evidence.reproductionSelection.commands`.
FIX = update the validator to enforce the current authoritative engine marker.
VERIFICATION = fresh WP0/static on the exact execution SHA.
PREVENTION = update contract assertions atomically with protocol/engine migrations; never require historical implementation strings as certification evidence.

RC-032 = Continuous-error-watch self-test expected `RED_INTERNAL` without `EVIDENCE_CAPTURE=AVAILABLE`; under the current fail-closed contract this correctly resolves to `FAIL_CLOSED`.
FIX = make the internal RED fixture provide explicit evidence.
VERIFICATION = watcher self-test on the exact execution SHA.
PREVENTION = missing evidence must never be used to manufacture an internally repairable RED.

RC-033 = Daily Green Gate accumulated duplicate watcher runs because workflow_run events shared one non-canceling global concurrency lane.
FIX = branch-scoped superseding watcher concurrency; Auto-Repair remains non-canceling.
VERIFICATION = concurrency contract + exact-SHA watcher self-test.
PREVENTION = observer workflows are supersedable; mutation workflows remain serialized.

RC-034 = Auto-Repair publication could rebase a verified repair onto a newer `execution` head after the target moved during diagnosis, creating stale repair commits and repeatedly canceling fresh canonical CI.
FIX = require local base == failed target SHA == remote execution SHA before commit, and require remote execution to equal the repair commit parent before push; remove stale rebase fallback.
VERIFICATION = Auto-Repair boundary/final architecture contracts on the resulting exact SHA.
PREVENTION = execution head movement is always fail-closed during a repair cycle; verified repairs never rebase across unrelated execution mutations.

RC-035 = Canonical build verification failed because src/routes/tools-page.tsx imported tools-modern.css from the wrong directory.
FIX = use the authoritative ../components/tools-modern.css import without creating a duplicate stylesheet.
VERIFICATION = fresh exact-SHA build, WP0, and Test Impact.
PREVENTION = keep route/component asset imports aligned with their owning filesystem authority.

RC-036 = Task Agent contract validation still required an obsolete governance phrase that was missing from the canonical المهام.md ledger.
FIX = record the explicit auto-merge-after-GREEN invariant in المهام.md while keeping the validator fail-closed.
VERIFICATION = fresh Task Agent/static/WP0 evidence on exact SHA.
PREVENTION = governance invariants are declared once in the executable ledger and verified there.

RC-037 = Firefox DEEP localization runtime checks intermittently timed out on Playwright networkidle while load/runtime assertions were otherwise healthy.
FIX = replace the browser-dependent networkidle wait with deterministic load + document.fonts.ready + double requestAnimationFrame + idle callback settling.
VERIFICATION = fresh canonical Browser FAST/DEEP execution on the exact SHA across all three engines.
PREVENTION = do not use networkidle as the synchronization primitive for this local static contract unless the application explicitly requires network quiescence.


RC-038 = Auto Repair Phase 1 previously failed with EXPECTED_SHA_MISSING despite target-file evidence existing.
FIX = propagate FLIXO_EXPECTED_TARGET_SHA through the job environment and retain file checks.
VERIFICATION = exact failed-SHA Phase 1 preflight and verified-repair handoff.

RC-039 = Auto Repair downstream postflight could mask the primary RED with a missing strategy artifact error.
FIX = gate dependent phases on upstream success and fail closed on missing strategy data.
VERIFICATION = next real Auto Repair failure/repair cycle.

RC-041 = Effective Home heroTitle markup mismatch for ms/uk caused the localization gate to reject raw <span> overrides.
RC-042 = PROJECTS.md retained a stale main SHA and obsolete canonical PR references after the execution→main topology was consolidated, causing live-state documentation to point at non-current verification targets.
FIX = reconcile the live state with verified main b80dbf2 and canonical PR #759 while keeping mutable execution/PR heads as live references rather than duplicated values.
VERIFICATION = re-read current main/execution refs and PR #759; fresh canonical CI remains required for GREEN.
PREVENTION = keep mutable execution state out of duplicated hardcoded fields and update topology references atomically with governance changes.
FIX = normalize the effective ms/uk heroTitle overrides to the canonical [[...]] marker contract.
VERIFICATION = validate:effective-localization + WP0 + canonical browser CI on the exact execution SHA.
PREVENTION = presentation HTML belongs to AgentFirstHome; localization data stores semantic markers only.
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
| AUTO-REPAIR-BOT-001 | VERIFYING / EVIDENCE-PENDING | Auto Repair + Task Agent + Error Agent + Action Vault triad | إثبات verifier-proof admission + repair publication + learning + handoff على current SHA |
| EXECUTION-BOT-WATCHDOG-001 | ACTIVE | execution-bot-watchdog | Verify exact-SHA RED detection and canonical repair dispatch |
| REPAIR-SUPERVISION-GATES-001 | VERIFYING / EVIDENCE-PENDING | handoff/recovery/merge gates | إثبات fail-closed handoff→merge chain على exact current SHA |
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


## 2026-09-20 — BUILD WAVE BATCH BINDING

Implementation ledger only; not GREEN/certification evidence.

- ERROR-INTELLIGENCE-001: IMPLEMENTED / VERIFICATION PENDING — Repair Hypothesis + Regression Sentinel.
- BATCH-1: IMPLEMENTED / VERIFICATION PENDING — control/evidence spine.
- BATCH-2: IMPLEMENTED / VERIFICATION PENDING — deterministic catalog fingerprint.
- BATCH-3: IMPLEMENTED / VERIFICATION PENDING — execution security/trace/recovery contracts.
- BATCH-4: IMPLEMENTED / VERIFICATION PENDING — shared contract harness.
- BATCH-5: IMPLEMENTED / VERIFICATION PENDING — performance manifest.
- BATCH-6: IMPLEMENTED / VERIFICATION PENDING — release evidence binding.
- BATCH-7: IMPLEMENTED / VERIFICATION PENDING — deterministic hybrid knowledge retrieval.
