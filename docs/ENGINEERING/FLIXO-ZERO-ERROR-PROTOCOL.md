# FLIXO ZERO-ERROR ENGINEERING PROTOCOL

**Status:** OFFICIAL / PERSISTENT / REPOSITORY-GOVERNING
**Version:** 1.0.0
**Purpose:** Preserve the complete engineering operating contract across sessions, agents, and future repairs.

## 1. Absolute objective

The repository is not complete because CI is green. It is complete only when the latest Exact-SHA is proven correct, reproducible, fully covered, fully evidenced, fail-closed, and free of unresolved root causes.

`COMPLETION = 100%` is mandatory.

Any value below 100% means execution continues.

## 2. Zero-stop law

The execution agent MUST NOT stop because the first failure was fixed, one workflow became green, a subset of tests passed, a preview deployment is Ready, failures are numerous, a failure is inconvenient to diagnose, or historical evidence is green.

The only terminal state is verified 100% completion. A genuinely external blocker may be recorded, but it is never counted as success and execution must resume when the blocker clears.

## 3. Zero-patching law

All repairs MUST be root-cause repairs at the authoritative owner.

Forbidden as a means of hiding or bypassing a failure: weakening or deleting assertions; skip/only/quarantine workarounds; arbitrary allowlists; browser- or route-specific hacks; artificial waits or timing padding; unexplained retries used to obtain green; fallback coercion that converts missing/invalid state into success; hard-coded success counters; `?? 0`; silent defaults; empty catches; suppressed errors; reducing routes/locales/tools/browsers/assertions; duplicate certification paths; replacing a broken invariant with a downstream exception.

A legitimate optimization or resilience mechanism is allowed only when its correctness is independently proven and it does not reduce coverage or hide failures.

## 4. Unified execution loop

`SNAPSHOT → INVENTORY → MODEL → DIAGNOSE → ROOT-CAUSE ID → REPAIR OWNER → FOCUSED VERIFY → AFFECTED GRAPH → GLOBAL RESCAN → NEGATIVE/MUTATION VERIFY → EVIDENCE → EXACT-SHA COMMIT → RECOMPUTE 100% → REPEAT`

After every repository-changing commit, all previous certification evidence is considered stale unless it explicitly and cryptographically matches the new SHA and inputs.

## 5. Complete repository diagnostics

The agent MUST inspect the entire repository, including source, tests, scripts, public assets, configs, docs, workflows, fixtures and generated outputs; npm scripts and every referenced command/file; imports/dependencies and dependency cycles; build graph and artifact producers/consumers; duplicated, orphaned, unreachable, dead or conflicting code; runtime exceptions, console errors, network failures, race conditions, nondeterminism and resource leaks; data/schema/config/environment mismatches; security and supply-chain risks; documentation drift.

No diagnosis may be limited to files mentioned by the latest failure.

## 6. Single source of truth

`TOOLS_REGISTRY` remains authoritative for tool identity and readiness.

Prove exact parity for Registry ↔ Router, Registry ↔ Route Resolver, Registry ↔ Sitemap, Registry ↔ SEO, Registry ↔ E2E. Find duplicate/manual/stale lists, dead aliases, readiness drift, route drift and metadata drift.

## 7. Mandatory contracts

Validate G1, G2, G3 and G4 end-to-end.

G1: structural architecture, registry, routing, resolver, sitemap, SEO manifest, canonical origin, indexability, locale matrix and readiness.

G2: extension, MIME, magic bytes, signatures, filenames, containment and unsafe-input rejection.

G3: output existence/type/signature, byte integrity, SHA, filename, download integrity and corruption resistance.

G4: public browser contract including route/HTTP/document/lang/dir/title/description/H1/canonical/hreflang/robots/structured data/translation/accessibility/runtime/console/network/interaction/output.

## 8. Localization and SEO

All 20 supported locales MUST be explicitly covered. No English fallback may be counted as a passing translation.

Validate localized title, description, H1, visible UI, alt text, category, how-to, features, SEO metadata, route, language, direction, canonical, hreflang, x-default and indexability.

Production canonical must use the authoritative real production origin. Sentinel origins are limited to explicitly allowed unit/contract contexts and must never leak into production certification.

## 9. Browser coverage

FAST coverage MUST equal exactly `22 tools × Chromium × Firefox × WebKit = 66 execution units`.

DEEP coverage MUST equal the complete required public-route set across all 20 locales and all 3 browsers.

The expected set and actual set MUST be machine-compared. Missing execution is FAIL, not zero.

## 10. Assertion integrity

Use the canonical assertion registry and test plan as machine-readable authorities.

Every assertion must be uniquely identified, owned by exactly one authoritative check, reachable/executable, linked to its contract and dependencies, and represented in expected and actual execution sets.

Orphaned, duplicated, missing or unreachable assertions are defects.

Mutation/negative verification MUST prove critical assertions fail when their invariant is deliberately broken.

## 11. Root-cause accounting

Every persistent failure receives a deterministic Root Cause ID.

A root cause is closed only with `reproduction → root cause → owner repair → regression proof → affected graph proof → evidence`.

Derived failures may be grouped for analysis, but no real failure may be hidden.

Final state requires `independent root causes = 0`, `derived failures = 0`, `unknowns = 0`.

## 12. Evidence and provenance

Certification evidence MUST bind exact repository SHA, contract version, test-plan hash, assertion-registry hash, package-lock hash, runtime identity, browser/project identity, artifact identity/hash, execution scope, expected assertions, actual assertions, root-cause state, timestamps and provenance.

Any mismatch, missing field, stale input or unverifiable provenance is FAIL.

## 13. Fail-closed certification

The certifier MUST reject missing evidence; undefined/null/NaN/invalid counters; missing execution units; missing assertions; partial coverage; stale evidence; SHA or artifact mismatch; unknown state; unauthorized skip; unresolved root cause.

No default value may transform absence into success. In particular, hard-coded zero counters and permissive null-coalescing in certification logic are forbidden unless the existence and semantic validity of the source value has already been proven.

The certifier itself MUST have negative tests proving that invalid certification inputs fail closed.

## 14. CI architecture

Maintain one authoritative automatic certification workflow and one canonical static/build/browser/evidence/certification lineage.

Do not create shadow certifiers, duplicate builds, duplicate browser engines, duplicate matrices or competing evidence authorities.

Every workflow must be classified as authoritative, diagnostic or advisory. Diagnostic/advisory workflows must never silently certify or bypass the authoritative gate.

## 15. Speed without loss of correctness

Use impact-analysis DAG; dependency-aware parallelism; one immutable build per verification scope; artifact reuse only when SHA/input identities match; controlled concurrency; fail-fast for diagnostic isolation without terminating the overall mission; deterministic retry only for proven transient infrastructure conditions; bisection and minimal reproductions for diagnosis; cached dependencies/builds with identity validation.

Speed optimizations MUST NEVER remove expected coverage or evidence. Release correctness has priority over timing.

## 16. Anti-patch and anti-regression enforcement

Continuously scan for `skip`, `only`, `todo-pass`, `flaky`, `quarantine`, artificial waits, retry inflation, forced success, suppressed exceptions, empty catches, allowlists, browser/route exceptions, `?? 0`, stale manifests and duplicate sources.

Every suspicious construct must be classified and justified by architecture; otherwise it is a defect.

Enforce invariants continuously so repaired conditions cannot drift back.

## 17. Proof-carrying repair

Every repair commit must be traceable to `RC-ID + violated invariant + owner + regression assertion + affected validation + evidence identity`.

A green result without this chain is insufficient for certification.

## 18. Security and robustness diagnostics

Inspect input validation, path containment, file signatures, unsafe files, artifact tampering, dependency integrity, lockfile consistency, workflow injection surfaces, permissions, secret exposure patterns, runtime isolation and supply-chain drift.

Security-relevant failures are first-class root causes.

## 19. Final 100% gate

Certification is PASS only if every required count is exactly zero and completion is exactly 100%, including root causes; derived failures; unknowns; unauthorized patches/workarounds; unauthorized skips; invalid evidence; stale evidence; SHA mismatches; artifact mismatches; missing assertions; orphaned assertions; duplicate unintended assertions; missing tools/routes/locales/browser units; readiness violations; registry/router/sitemap/SEO/E2E drift; G1/G2/G3/G4 failures; runtime/console/network failures; i18n/SEO/a11y failures; certification failures; unresolved contract failures.

## 20. Persistence and precedence

This document is repository-tracked and MUST persist across sessions, agents and future work. It is the canonical persistent engineering protocol for this repository.

Every future agent MUST read it before changing the testing/certification architecture or declaring completion.

This protocol takes precedence over ad-hoc conversational instructions that conflict with it, except for an explicitly versioned superseding repository protocol that is itself verified and committed under the same evidence discipline.

Deleting, bypassing, disabling, or silently weakening this protocol is a protocol violation and must be treated as a root-cause failure.

## 21. Non-negotiable final state

`100% PROVEN COMPLETION`
`0 ROOT CAUSES`
`0 PATCHES`
`0 UNKNOWN`
`0 UNAUTHORIZED SKIPS`
`0 DRIFT`
`0 INVALID/STALE EVIDENCE`
`0 SHA/ARTIFACT MISMATCH`
`0 MISSING COVERAGE`
`ZERO FALSE GREEN`
