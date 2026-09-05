# FLIXO Consolidation Log

## Current State — 2026-08-28

### CURRENT MAIN SHA
`c81d6da7fcb8bf02334d11e3ce8254f19ef3e793`

This section is the authoritative current-state snapshot for consolidation work. Older sections below are historical evidence only.

### Current Repository State

- Production source of truth: `main`.
- Latest inspected `main` commit: `c81d6da7fcb8bf02334d11e3ce8254f19ef3e793` — `feat(brand): unify FLIXO logo identity (#436)`.
- Open pull requests at inspection time: `1` (`#435 — feat(i18n): strict localization quality gate`).
- PR #436 is merged into `main`.
- Vercel status for the exact `main` SHA: `success` (deployment-provider evidence).
- Full Matrix Promotion for the exact `main` SHA: Run `33173614731` = `success` (23 suites × 3 browsers).
- Canonical GitHub CI certification is not asserted without completed exact-SHA canonical evidence.
- Current consolidation issues: `#127`, `#133`, `#73`.
- This synchronization changes documentation only; it does not modify application runtime behavior.

### Current Consolidation Direction

```text
Current main evidence
      ↓
Debt register
      ↓
Strict i18n gate / PR #435
      ↓
Single ToolDefinition contract
      ↓
Registry as source of truth
      ↓
Derived Router / SEO / Sitemap / Manifest / E2E
      ↓
Verification consolidation
      ↓
Canonical origin cleanup
      ↓
i18n ownership cleanup
      ↓
Dependency and artifact governance
      ↓
Shared test harness
      ↓
Final exact-SHA release certification
```

### Evidence Classification

Deployment status and engineering evidence are tracked separately. Vercel success is deployment-provider evidence only. Full Matrix success is browser evidence for the exact `main` SHA. Release certification still requires the repository's canonical verification path plus any other required release evidence on the same SHA.

### Active Debt Register

See `docs/DEBT-REGISTER.md` for the active engineering debt inventory and exit criteria.

---

## Historical Record — Phase 0 Baseline (2026-08-23)

### BASE SHA
`d543c3ce7a69c44731a19ab82f85051cfb891e6b`

This was the `main` commit after PR #268 was merged.

### CI State
- GitHub Actions workflow runs associated with the BASE SHA: none returned by the available workflow-run query.
- GitHub commit status: Vercel = failure due to external deployment quota (`api-deployments-free-per-day`).
- Interpretation: deployment was unverified; this was not treated as application-code failure evidence.

### Open PR State
- PR #263 — `test(i18n): enforce translation type boundary` — open, draft, not mergeable at baseline inspection.
- PR #219 — `chore(deps): upgrade Recharts to 3.10.1` — open, not mergeable at baseline inspection.
- PR #268 — `refactor(i18n): prepare independent Home locale modules` — merged into `main` at BASE SHA.

### Sensitive File Baseline

#### package manifests
- `package.json`: `a3a497a276cf7c4f936d22002464701138853b6d`
- `package-lock.json`: `4dec433081aec86521212283bc36ec44eade3b1f`

#### i18n
- `src/lib/i18n/types.ts`: `469a7b344d1c0d559cc59fffde6e6e2bb1f3c2f7`
- `src/lib/i18n/translations.ts`: `45c34487b8715b92499174fcda38a1f617ee5b29`
- `src/lib/i18n/loader.ts`: `7b05a687b86321e8f730ae476bffdcc31adbb1aa`
- `src/lib/i18n/home-loader.ts`: `91dfa775be19f78b2cb2460042281105a3dba747`
- `src/lib/i18n/config.ts`: `2a4daeb12c0790500f8eb4f3d414e83da6de99f3`
- `src/lib/i18n/index.ts`: `d42dc01084c2f08ef9367076bff3803ed08dbc5f8`

#### data
- `src/data/home-i18n.ts`: `ac30b2f3e26e2604e28ec21036fa014ee5ea6efe`
- `src/data/home-locales.ts`: `e6199a1bb1a8ecf34c57e27365354b9ed8469e09`
- `src/data/home-copy.ts`: `d740c139554fce3b851c286fbb879b3681af4c04`
- `src/data/quickflow-i18n.ts`: `446912c1771857e383ba57d40d934826d04b2566`
- `src/data/quickflow-locales.ts`: `445c37bca1d2d59e1aa7ccbd485816ec1477b458`
- `src/data/tool-ui-i18n.ts`: `2a0b12879d9912f0a28db3236e4a39427b3bbe69`

#### routes
- `src/routes/__root.tsx`: `1fc7db6f43042b56bc4d56fbb45e343ccf227e21`
- `src/routes/home-page.tsx`: `206c5e7f4179a1d99489ce46c564c7472ca2e809`
- `src/routes/ar-home-page.tsx`: `7724bfc733e8532ec4c532bcbb442b3e358c510a`
- `src/routes/index.tsx`: `7e6d2012a417e76042528dcf9fa91ca9e6736f5b`

#### CI workflows
- `.github/workflows/ci.yml`: `bb651afa77790205f089e17116933789f3430798`
- `.github/workflows/browser-smoke.yml`: `ffedd8efd599df49b196874f5a1baa80819e99a9`
- `.github/workflows/full-matrix-promotion.yml`: `4832b93ce15215ac646c15f1c007ccb974ad19bf`
- `.github/workflows/localization-core.yml`: `eeea0ec2adeaf6a2688cf12cac2e0494602a957b`
- `.github/workflows/claude-security-review.yml`: `94f0fa13d5a108d57aa1b1a05bfb5377cc54ad39`

### Historical Expected Effect
Freeze a known rollback point before subsequent consolidation work.

---

## Historical Record — Earlier Consolidation State

- Original baseline SHA: `72be5e7398821c9c62384e96d71225dcee14dac6`
- Phase 1 main SHA at the time: `aa945a4960a40a82c0588aa439d3be62a09ef3b8`
- Rebuild candidates included `rebuild/seo-126-on-main`, `rebuild/governance-134-on-main`, and `recharts-v3-test`.
- Historical architecture evidence established 20 locales, lazy locale loading, deterministic-first QuickFlow, optional AI refinement, `check` as repository/build gate, `verify` as release-oriented gate, and independent full-browser promotion.

## Historical Execution Register

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
6. Vercel quota/deployment-provider failures remain external deployment conditions.
7. Merge is allowed only after fresh evidence exists for the exact PR head SHA.
8. The current-state section at the top of this file supersedes all historical baselines below it.

## Rollback Contract

Every consolidation PR records:

- Before SHA
- After SHA
- Changed files
- Expected behavior
- Validation evidence
- Rollback method

Rollback uses `revert` of the merge commit whenever possible; emergency manual repair is not the default rollback strategy.
