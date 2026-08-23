# FLIXO Consolidation Log

## Base Baseline

- **Original baseline SHA:** `72be5e7398821c9c62384e96d71225dcee14dac6`
- **Phase 1 current main SHA:** `aa945a4960a40a82c0588aa439d3be62a09ef3b8`
- **Date:** 2026-08-23
- **Source:** `main`
- **Baseline CI state:** Code gates were exercised for PR-1; the only combined status reported on the PR-1 head was the external Vercel quota failure. No Vercel failure is treated as application-code GREEN or application-code failure.
- **Current rollback point:** `aa945a4960a40a82c0588aa439d3be62a09ef3b8` before Phase 1.1 work.

> The current `main` SHA is authoritative for all new work. Older proposed SHAs are historical references only.

## Phase 1.1 Triage State

The explicitly requested cleanup list `#91, #102, #103, #104, #106, #110, #111, #112, #113, #115` is not present in the current open-PR inventory, so no additional close action was performed.

Rebuild/isolation branches created from current `main`:

- `rebuild/seo-126-on-main` — rebuild candidate from #126.
- `rebuild/governance-134-on-main` — rebuild candidate from #134.
- `recharts-v3-test` — isolated Recharts v3 experiment from current `main`.

## Repository State

### Sensitive files recorded

- `package.json` — scripts, dependencies, and verification contract.
- `package-lock.json` — lockfile state.
- `src/lib/i18n/` — locale metadata, types, loader, and dictionaries.
- `src/data/` — localized/shared data contracts.
- `src/routes/` — route surface.
- `.github/workflows/` — CI and promotion workflows.

### Current architecture evidence

- 20 configured locales are declared in `src/lib/i18n/config.ts`.
- Locale dictionaries are loaded through `src/lib/i18n/loader.ts` with dynamic imports and Promise caching.
- QuickFlow is deterministic-first and returns a ready-tool plan only when the configured threshold is met.
- AI Planner is optional and falls back to the deterministic plan when disabled, unavailable, or unsuccessful.
- `npm run check` is the repository/build gate; `npm run verify` is the release-oriented gate; `npm run test:e2e` is browser smoke.
- Full browser promotion is defined separately in `.github/workflows/full-matrix-promotion.yml`.

## Execution Register

| Work item | Phase | Status | Before SHA | Expected effect | Validation | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| PR-1 | Phase 0 + 1.2 | **MERGED** | `72be5e7` | Establish evidence-first baseline and governance docs | Docs diff + exact-SHA CI | Revert merge commit `aa945a4` |
| PR-2 | Phase 1.1 | **IN PROGRESS** | `aa945a4` | Triage legacy PRs and isolate viable work | Current-main rebuild + CI | Revert merge commit / close PR |
| PR-3 | Phase 2.1 | Pending | Exact PR-2 output | Move i18n types without runtime behavior change | Typecheck + lint | Revert merge commit |
| PR-4 | Phase 2.2 | Pending | Exact PR-3 output | Enforce lazy locale runtime | Typecheck + lint + i18n + build | Revert merge commit |
| PR-5 | Phase 2.3/2.4 | Pending | Exact PR-4 output | Localized route + home locale migration | Targeted localization E2E + full verify | Revert merge commit |
| PR-6 | Phase 2.5 | Pending | Exact PR-5 output | Prove locale bundle isolation | Build chunk inspection | Revert merge commit |
| PR-7 | Phase 3 | Pending | Exact PR-6 output | Unify `check` / `verify` and release truth | Full CI + contracts | Revert merge commit |
| PR-8 | Phase 4.1 | Pending | Exact PR-7 output | Zero-cost initial AI/QuickFlow loading | Bundle proof + E2E | Revert merge commit |
| PR-9 | Phase 4.2/4.3 | Pending | Exact PR-8 output | Deterministic dispatcher + predictive preload | Latency/bundle/E2E evidence | Revert merge commit |

## Operating Rules

1. `main` receives no direct development changes.
2. One coherent problem per PR.
3. No dependency upgrades inside unrelated refactors.
4. No deletion of historical code solely for cleanliness.
5. A local pass is not release evidence.
6. Vercel quota/deployment-provider failures are external deployment conditions; they do not fabricate application GREEN or application failure.
7. Merge is allowed only after fresh evidence exists for the exact PR head SHA, unless an explicit operator decision overrides the gate.

## Rollback Contract

Every consolidation PR records:

- Before SHA
- After SHA
- Changed files
- Expected behavior
- Validation evidence
- Rollback method

Rollback uses `revert` of the merge commit whenever possible; emergency manual repair is not the default rollback strategy.
