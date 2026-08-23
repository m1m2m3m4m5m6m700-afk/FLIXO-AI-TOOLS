# FLIXO Consolidation Log

## Base Baseline

- **Base SHA:** `72be5e7398821c9c62384e96d71225dcee14dac6`
- **Date:** 2026-08-23
- **Source:** `main`
- **Previous parent:** `c5c55951e6317dd467c290940c58e9a94beff3d3`
- **Baseline CI state:** **UNVERIFIED** for this exact SHA through the available workflow-run evidence interface. No current green certification is claimed.
- **Rollback point:** the Base SHA above.

> The baseline SHA in this log is authoritative. Older proposed SHAs are historical references and must not be reused as the current rollback point.

## Repository State at Baseline

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
- QuickFlow is deterministic-first and returns a ready-tool plan only when the intent score clears the configured threshold.
- AI Planner is an optional refinement layer and falls back to the deterministic plan when disabled, unavailable, or unsuccessful.
- `npm run check` is the repository/build gate; `npm run verify` is the release-oriented gate; `npm run test:e2e` is browser smoke.
- Full browser promotion is defined separately in `.github/workflows/full-matrix-promotion.yml`.

## Open PR Inventory at Baseline

The current open-PR search returned the following seven open PRs. They are **not** automatically merged or closed by Phase 0.

| PR | Head | Base | Baseline action |
| --- | --- | --- | --- |
| #219 | `chore/recharts-v3-readiness` | `main` | Isolate and reassess after current-main validation |
| #134 | `chore/main-governance-unification` | `main` | Rebuild useful work on current `main` if still needed |
| #126 | `feat/seo-cwv-hardening` | `main` | Rebuild useful work on current `main` if still needed |
| #108 | `fix/pdf-merge-arraybuffer` | `main` | Triage for superseded/obsolete state |
| #105 | `feat/ai-preflight-p0` | `experimental` | Keep isolated; do not promote directly to `main` |
| #98 | `fix/ci-main-pr-trigger` | `main` | Triage against current CI contract |
| #89 | `governance/vercel-nonblocking` | `main` | Triage against current release policy |

## Execution Register

| Work item | Phase | Status | Before SHA | Expected effect | Validation | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| PR-1 | Phase 0 + 1.2 | Pending | `72be5e7` | Establish evidence-first baseline and governance docs | Docs diff + exact-SHA CI | Revert merge commit |
| PR-2 | Phase 1.1 | Pending | `72be5e7` | Triage legacy PRs and isolate viable work | Current-main rebuild + CI | Revert merge commit / close PR |
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
6. A Vercel quota/deployment-provider failure is recorded as an external deployment condition; it does not become a fabricated code GREEN.
7. Merge is allowed only after fresh evidence exists for the exact PR head SHA.

## Rollback Contract

Every consolidation PR must record:

- Before SHA
- After SHA
- Changed files
- Expected behavior
- Validation evidence
- Rollback method

Rollback uses `revert` of the merge commit whenever possible; emergency manual repair is not the default rollback strategy.
