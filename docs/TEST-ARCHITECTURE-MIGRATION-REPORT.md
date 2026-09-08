# FLIXO-AI-TOOLS — Test Architecture Migration Report

## Certification reference

Current `main` Exact-SHA: `89524448dd99636cc3488b27533f5da1227e0bb3`.

This report records the architecture migration requested for the canonical test system. A green CI certification is **not** claimed by this report.

## Implemented

1. Added `scripts/ci/assertion-registry.json` as the canonical assertion ownership registry. Each assertion now carries an owner, contract, coverage, dependencies, runtime scope, and root-cause class.

2. Added `scripts/ci/validate-assertion-registry.mjs` and wired it into CI. It rejects owner collisions, missing assertions, coverage drift, dependency references to unknown assertions, and architecture regressions. It also enforces that Fast Verify does not directly run Playwright specs, Matrix First retains 22 tool specs across Chromium/Firefox/WebKit, Full Matrix remains deep-only, and Ultra declares an orchestrator-only role.

3. Updated `scripts/ci/test-plan.json` to reference the canonical assertion registry and to declare the source dependency graph. The plan still owns the 26 static checks, 2 build checks, and 3 browser dimensions.

4. Refactored `scripts/ci/fast-verify.mjs` into an impact selector over canonical test-plan owners. It no longer invents a separate browser execution path. Browser execution remains owned by Matrix First.

5. Refactored `scripts/ci/ultra-fast.mjs` into an orchestrator-only triage stage. Ultra now performs bounded diff inspection and evidence generation instead of re-running TypeScript, registry, router, or CI contract tests.

6. Restructured `.github/workflows/ci.yml` so Matrix First is no longer an early execution barrier. The final certification stage checks the exact-head Matrix First Certification result only after the other canonical lanes finish.

7. G3 now has one canonical build in `g3-foundation`; the produced `dist/` artifact is retained with exact SHA and package-lock identity and is consumed by `g3-browser`. The browser path no longer invokes a second build.

8. Fixed the G3 preview bootstrap path so a dead or non-ready preview fails as a runtime boot failure rather than being converted into downstream browser errors.

9. Removed the legacy G3 Shadow dependency from authoritative aggregation. G3 aggregation now classifies primary failures separately from derived/blocked failures and does not count dependency-propagated failures as independent root causes.

10. Updated `scripts/test.mjs` so the canonical report distinguishes `rootCauses`, `rootCauseGroups`, `independentRootCauseCount`, and `derivedFailureCount`.

11. Moved standalone G1, G2, and G3 duplicate gates to `workflow_dispatch` manual diagnostic mode. They no longer participate in the normal push/PR path.

12. Kept Full Matrix as a separate deep regression surface: public routes × canonical locales × Chromium/Firefox/WebKit. It was not deleted or replaced by Matrix First.

13. Standardized `VITE_TEST_ORIGIN` for Matrix First, Full Matrix, the canonical CI workflow, G1/G2/G3 manual diagnostics, and the localization deep diagnostic to `http://127.0.0.1:3000`. Production origin remains `https://flixoai.vercel.app`.

14. The previously completed removal of `STATIC-018 / locale-integrity` and its wrapper remains intact; its effective localization coverage is represented by the surviving canonical validators.

## Coverage intentionally preserved

- Matrix First: 22 tool specs × 3 browsers = 66 browser execution units across deterministic shards.
- Full Matrix: route/locale runtime regression across the supported 20 locales and 3 browsers.
- G1/G2/G3/G4 canonical contract layers.
- Artifact/file integrity and determinism.
- Browser runtime, visible localization, accessibility, console/network, and interaction assertions already owned by the canonical suites.

No test was removed solely to reduce the count. Removal/consolidation was limited to wrappers, duplicate execution paths, legacy shadow participation, and orchestration duplication.

## Remaining work

1. **Runtime certification is still pending.** The available GitHub status for the current SHA reports a Vercel failure with target reason `build-rate-limit`. This prevents a truthful Green certification for the current head.

2. **GitHub Actions execution evidence must be collected on the current SHA.** The architecture has been committed, but this report does not substitute for an actual successful run of the canonical CI, Matrix First, and deep Full Matrix gates.

3. **Full evidence-ledger consolidation is not yet complete across every lane.** G3 has an authoritative ledger and Fast/Ultra have exact-SHA evidence, but a single repository-wide evidence authority that consumes every gate artifact is still a remaining architectural step.

4. **Impact analysis remains partly pattern-based.** The explicit assertion registry/dependency metadata is now authoritative for ownership, but the file-to-assertion impact mapping in Fast Verify is still rule-based and should be upgraded to a first-class dependency graph for higher precision.

5. **The canonical environment contract can be strengthened further.** Application code still contains `https://canonical.test` as a non-CI fallback/test sentinel. It is not used by the canonical CI workflow after the changes above, but a future environment-contract validator should distinguish intentional local fallback from forbidden certification provenance.

## Architectural end state

`Requirement → Invariant → Assertion → Canonical Owner → Routine Execution Owner → N Evidence Consumers → Certification Authority`.

Root-cause reporting follows:

`Primary Failure → blocked/derived assertions`,

with blocked/derived failures excluded from the independent root-cause count.
