# Agent Contract

The repository uses one automatic test workflow: `.github/workflows/ci.yml`.

## Execution model

- `static` owns all non-browser contracts: registry, routing, SEO, i18n, G2/G3 integrity, configuration, dependency and CI contracts.
- `build` performs the one canonical production build and publishes one immutable artifact identified by exact commit SHA and package-lock digest.
- `browser-fast` is the only fast browser engine: 22 canonical tools × Chromium/Firefox/WebKit = 66 execution units.
- `browser-deep` is the same browser engine in deep mode: canonical public-route localization/runtime coverage across 20 locales and Chromium/Firefox/WebKit. It runs on main/release paths, not PR fast path.
- `certify` is the only automatic certification authority. It is fail-closed and consumes evidence from the same workflow run.

## Safety invariants

- Do not delete coverage to obtain Green. Consolidate duplicate execution only.
- Preserve G2, G3, G4, Exact SHA, immutable artifact identity, negative readiness, localization, accessibility, console/network, artifact integrity and determinism coverage.
- Fast Verify and Ultra may select/classify work, but must not create a second browser execution owner.
- One assertion has exactly one canonical execution owner.
- One automatic workflow must own routine certification. Retired/shadow workflows are manual diagnostics only and never certify releases.
- `https://canonical.test` is a restricted unit/contract sentinel and is forbidden from certification provenance.
- GREEN is valid only when every required engine passes, evidence is valid and complete, Exact SHA matches, and independent root causes are zero. Skips, masked failures, stale evidence and partial passes are not Green.
- Never claim a green release without fresh exact-SHA CI evidence.
