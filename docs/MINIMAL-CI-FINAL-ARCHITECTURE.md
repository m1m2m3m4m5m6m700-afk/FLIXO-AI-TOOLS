# Minimal CI Architecture

The canonical automated test system has one orchestration authority: `.github/workflows/ci.yml`.

The canonical control plane is:

1. `scripts/ci/test-plan.json` — coverage and execution plan.
2. `scripts/ci/assertion-registry.json` — assertion ownership and dependency graph.
3. `scripts/ci/certify.mjs` — single fail-closed certification authority.
4. One immutable production build artifact reused by all browser execution.
5. Browser execution has only two modes: FAST (22 tools × Chromium/Firefox/WebKit) and DEEP (20 locales × required routes × Chromium/Firefox/WebKit).

Required safety invariants are unchanged: Exact SHA, lock/artifact identity, G2 file safety, G3 output integrity, G4 browser/runtime coverage, negative readiness, evidence provenance, root-cause accounting, and fail-closed certification.

Any remaining retired/manual workflow is non-authoritative and must not duplicate automated coverage.
