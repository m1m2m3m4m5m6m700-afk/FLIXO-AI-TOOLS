# FLIXO AI Tools

FLIXO is a browser-first toolbox built with React, Vite, TypeScript, and TanStack Router. The production source of truth is `main`; every change reaches `main` through a small, reviewable PR with fresh CI evidence for the exact commit.

## Production foundation

- React 19 + Vite + TypeScript.
- TanStack Router with route-isolated features.
- **20 configured locales** with explicit LTR/RTL metadata.
- Lazy-first locale dictionaries: the runtime loader uses dynamic imports and Promise caching.
- Browser-first processing for supported client-side tools.
- **QuickFlow** as the deterministic-first task planner.
- **AI Planner** as an optional refinement layer with deterministic fallback.
- Repository checks for type safety, lint, routing, localization, SEO, build, audit, and performance budgets.
- Playwright browser smoke plus an independent full-browser promotion matrix.

## Engineering model

```text
main
  |
  +-- feature/* or chore/*
        |
        +-- small change
        +-- targeted validation
        +-- PR
        +-- exact-SHA CI
        +-- diff review
        +-- merge only when GREEN
```

`main` is never the scratchpad. Experimental, diagnostic, repair, and historical branches are not production inputs until deliberately rebuilt against current `main` and verified again.

## Verification contract

### Fast development gate

```bash
npm run verify:fast
```

### Repository/build gate

```bash
npm run check
```

`check` is deterministic and covers the baseline, router registry, localization, SEO, full localization validation, build, and performance-budget checks defined in `package.json`.

### Release gate

```bash
npm run verify
```

`verify` is the release-oriented code gate and adds the production dependency audit to the repository check.

### Browser verification

```bash
npm run test:e2e
```

The full 23-suite × 3-browser promotion matrix runs independently through `.github/workflows/full-matrix-promotion.yml`.

## Internationalization

Locale identifiers and metadata live in `src/lib/i18n/config.ts`. Locale dictionaries live in `src/lib/i18n/locales/`, and runtime access is owned by `src/lib/i18n/loader.ts`.

The lazy-first rule is strict: production entry points must not statically import every locale dictionary. Bundle separation is a release concern and will be proved with dedicated build inspection before the i18n consolidation is considered complete.

## QuickFlow and AI

QuickFlow first chooses a ready tool deterministically from the user intent. AI is optional and may refine an already valid deterministic plan; disabling AI, losing the network, or returning an invalid result must not break the deterministic path.

Future performance work will preserve **zero AI cost on the initial page** and load expensive AI/QuickFlow modules only when the relevant feature is requested.

## Evidence-first release rule

A local success is development evidence, not release certification. A change is considered green only when the canonical checks and relevant browser evidence pass for the **exact commit SHA** being promoted.

Provider-side deployment limits, such as a Vercel quota error, are tracked as external deployment conditions. They are never converted into a fake application GREEN or a fake application failure without matching code evidence.

## Development

```bash
npm ci
npm run dev
```

See `docs/ARCHITECTURE.md`, `docs/RELEASE_POLICY.md`, and `docs/CONSOLIDATION-LOG.md` for the repository contracts and consolidation history.
