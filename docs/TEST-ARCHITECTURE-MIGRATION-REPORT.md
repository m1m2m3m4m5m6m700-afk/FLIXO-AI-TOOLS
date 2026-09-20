# FLIXO-AI-TOOLS — Test Architecture Migration Report

## Certification reference

Architecture baseline for this migration: `2f1353b1417fe76d75bb43ebd8ef11fc770641e3`.

The report is not itself a certification artifact. The exact certification SHA and runtime verdict are owned by `Global Certification Authority`, which consumes the exact-SHA GitHub Actions runs and their artifacts.

## Implemented

1. Added `scripts/ci/assertion-registry.json` as the canonical assertion ownership registry. Each assertion carries an owner, contract, coverage, dependencies, runtime scope, and root-cause class.

2. Added `scripts/ci/validate-assertion-registry.mjs` and wired it into CI. It rejects owner collisions, missing assertions, coverage drift, dependency references to unknown assertions, and architecture regressions. It also enforces Matrix First ownership, Full Matrix preservation, and Ultra orchestrator-only behavior.

3. Updated `scripts/ci/test-plan.json` to reference the canonical assertion registry and to declare gate dependencies and source dependencies.

4. Replaced Fast Verify path-pattern impact heuristics with `scripts/ci/impact-dependency-graph.json`. The flow is now deterministic: `changed file → source node → assertion → canonical owner → gate`. Unmapped files fail closed by escalating to all static/build owners; browser assertions remain reused from Matrix First rather than rerun by Fast Verify.

5. Refactored `scripts/ci/ultra-fast.mjs` into an orchestrator-only triage stage. Ultra performs bounded change/evidence classification instead of duplicating canonical contract execution.

6. Restructured `.github/workflows/ci.yml` so Matrix First is not an early execution barrier. Certification consumes its exact-head result only after the other canonical lanes finish.

7. G3 now has one canonical production build in `g3-foundation`; the immutable `dist/` artifact carries exact SHA and package-lock identity and is consumed by browser verification without rebuilding.

8. Removed legacy G3 Shadow participation from authoritative aggregation and separated primary failures from blocked/derived failures.

9. Updated `scripts/test.mjs` to report independent root causes separately from derived/blocked failures.

10. Moved duplicate G1/G2/G3 workflows to manual diagnostic mode and retained Full Matrix as a deep regression surface across public routes, 20 canonical locales, and Chromium/Firefox/WebKit.

11. Removed `STATIC-018 / locale-integrity` and its wrapper; effective localization coverage remains owned by surviving canonical validators.

12. Added `scripts/ci/origin-policy.json` and strengthened `validate-certification-surface.mjs`. `https://flixoai.vercel.app` is the sole production origin, `http://127.0.0.1:3000` is the canonical runtime origin, and `https://canonical.test` is a restricted unit/contract sentinel rather than certification provenance. It is explicitly forbidden in canonical certification workflows and runtime defaults.

13. Added `scripts/ci/global-evidence-authority.mjs` and `.github/workflows/certification-authority.yml`. The authority locates the newest `CI`, `Matrix First Gate`, and `Full Matrix Parallel` runs for one exact SHA, waits for completion, downloads their artifacts, validates lineage and evidence identity, and emits one repository-wide verdict:

    `Assertion → Execution → SHA → Environment → Artifact → Result → Root Cause`.

14. The Global Certification Authority fails closed on workflow/job failure, missing evidence, SHA mismatch, invalid JSON evidence, unauthorized Playwright skips, or independent root causes. It also asserts the required `22 × 3 = 66` Matrix First units and `20 locales × 3 browsers` Full Matrix contract.

## Coverage intentionally preserved

- Matrix First: 22 tool specs × 3 browsers = 66 browser execution units across deterministic shards.
- Full Matrix: public-route runtime regression across the supported 20 locales and 3 browsers.
- G1/G2/G3/G4 canonical contract layers.
- Artifact/file integrity and determinism.
- Browser runtime, visible localization, accessibility, console/network, and interaction assertions owned by canonical suites.

No test was removed solely to make CI faster or greener. Consolidation is limited to wrappers, duplicate ownership, redundant execution, and orchestration duplication.

## Runtime certification state

The final runtime verdict must be read from the GitHub Actions `Global Certification Authority` run for the exact head SHA. A queued run is not PASS, and a Vercel status failure caused by external `build-rate-limit` is not silently converted into internal certification evidence.

## Architectural end state

`Requirement → Invariant → Assertion → Canonical Owner → Routine Execution Owner → N Evidence Consumers → Certification Authority`.

Impact analysis:

`Changed File → Source Dependency Node → Assertion → Owner → Gate`.

Failure model:

`Primary Failure → blocked/derived assertions`,

with blocked/derived assertions excluded from the independent root-cause count.
