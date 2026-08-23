# FLIXO Consolidation Log

## Phase 0 — Baseline

**Date:** 2026-08-23

### BASE SHA
`d543c3ce7a69c44731a19ab82f85051cfb891e6b`

This is the `main` commit after PR #268 was merged.

### CI State
- GitHub Actions workflow runs associated with BASE SHA: none returned by the available workflow-run query.
- GitHub commit status: Vercel = failure due to external deployment quota (`api-deployments-free-per-day`).
- Interpretation: deployment is unverified; this status is not treated as code-failure evidence.

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
- `src/lib/i18n/index.ts`: `d42dc01084c2f08ef9367076bff3803ed08dbc5f`

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

### Change
Create an immutable baseline record before Phase 1 work.

### Expected Effect
No production behavior change. This branch only records the baseline and is isolated from `main`.

### Validation
- BASE SHA known.
- CI/status state known.
- Open PR state known.
- Sensitive file fingerprints recorded.
- Rollback point = BASE SHA.

### Rollback
No production rollback required. Reject/delete the Phase 0 branch/PR if the baseline record is not accepted; `main` remains unchanged at BASE SHA.
