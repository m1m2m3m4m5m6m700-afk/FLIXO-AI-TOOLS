# FLIXO Engineering Roadmap

**Status:** Adopted baseline roadmap
**Production branch:** `main`
**Canonical verification command:** `npm run verify`

## Operating rule

FLIXO is developed evidence-first. A successful deployment is not a substitute for GitHub Actions evidence on the exact commit being promoted.

## Phase 0 — Main Stabilization

- Prove the exact `main` HEAD with TypeScript, ESLint, build, production audit, CodeQL, Socket (when configured), and all isolated E2E jobs.
- Record the result by exact commit SHA.
- Enforce readiness alignment: only registry entries with `isReady: true` are public and indexable.
- Remove non-ready static routes and validate that localized routing returns not-found/noindex for non-ready tools.

**Done when:** the exact `main` SHA has a green canonical verification plus green required CI jobs, with no readiness drift.

## Phase 1 — Governance & Verification

- Keep `TOOLS_REGISTRY` as the authoritative tool inventory.
- Use `npm run verify` as the deterministic application gate.
- Keep per-job CI diagnostics for fast failure localization.
- Add a final canonical verification gate only after component jobs pass.

**Done when:** local `npm run verify` and CI canonical verification express the same application correctness contract.

## Phase 2 — Output Integrity

- Generalize the `Image Compressor` output contract into a reusable `ToolOutputContract`.
- Apply output validation to file-producing tools in measured waves.
- Validate MIME, signatures, decodeability, dimensions, and privacy metadata only where applicable.

**Done when:** every critical file-producing tool has a deterministic output contract and E2E evidence.

## Phase 3 — Global SEO & Localization

- Roll out per-tool SEO manifests from the golden references.
- Localize visible UI and search-critical content, not only metadata.
- Validate locale completeness without treating technical strings such as MIME names as untranslated UI.
- Keep canonical and `hreflang` generation derived from the same tool/locale contracts.

**Done when:** each ready tool is genuinely localized in its published locales and passes the SEO/localization gates.

## Phase 4 — Performance & Workers

- Profile before moving work off-thread.
- Extend Web Worker coverage to heavy tools only where profiling proves main-thread benefit.
- Measure lab regressions in CI and real-user CWV separately.

**Targets:**
- LCP p75 <= 2.5s
- INP p75 <= 200ms
- CLS p75 <= 0.1
- FLIXO internal INP target: <= 100ms after a stable baseline exists

## Phase 5 — Smart Product

- Expand deterministic intent routing.
- Add Smart Presets.
- Introduce a typed `IntentPlan` with explicit human-review requirements for ambiguous actions.
- Keep automatic execution disabled by default.

## Phase 6 — Optional AI / WebGPU

- Capability detection first.
- Deterministic local path always available.
- WASM fallback where appropriate.
- WebGPU and model loading are progressive enhancements and must not block the critical path.

## Phase 7 — QuickFlow

QuickFlow is split into small reviewable changes: contracts, deterministic workflows, localized intent pages, optional AI planner, execution, and golden E2E workflows.

## Promotion rule

No feature is promoted to `main` merely because Vercel is ready. Promotion evidence is the exact commit SHA plus passing required CI checks and the canonical verification gate.
