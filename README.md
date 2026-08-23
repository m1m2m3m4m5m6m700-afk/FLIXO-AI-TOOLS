# FLIXO AI Tools

FLIXO is a browser-first toolbox built on React, Vite, and TanStack Router. The current repository is intentionally small at the application core and keeps production changes isolated, testable, and evidence-driven.

## Current production foundation

- React 19 + Vite + TypeScript.
- TanStack Router with a shared root layout.
- 20 configured locales with explicit LTR/RTL metadata.
- Route-level localized homepage and image-compressor surfaces.
- Browser-first processing for supported client-side tools.
- Deterministic type, lint, routing, localization, SEO, build, audit, and performance checks.
- Playwright E2E smoke coverage.
- Repository guardrails that require fresh CI evidence before a release is considered green.

## Architecture principles

1. **Main is the production source of truth.** Historical or experimental branches are not release inputs.
2. **Lazy-first client loading.** Locale dictionaries and optional features should load on demand rather than becoming part of the initial bundle.
3. **Small shared surface.** Cross-cutting code belongs in shared infrastructure; feature code stays isolated.
4. **Evidence-first promotion.** A code change is not considered released because it looks correct locally; the required CI evidence must pass for the exact commit.
5. **No resurrection of legacy product code.** Old tools and historical experiments remain archived unless explicitly reintroduced as isolated features.

## Development

```bash
npm ci
npm run dev
```

## Verification

Fast development checks:

```bash
npm run verify:fast
```

Repository check/build gate:

```bash
npm run check
```

Full verification and production audit:

```bash
npm run verify
```

Browser smoke:

```bash
npm run test:e2e
```

## Internationalization

Locale metadata lives in `src/lib/i18n/config.ts`; dictionaries live in `src/lib/i18n/locales/`; runtime loading is provided by `src/lib/i18n/loader.ts`.

The target architecture is **lazy-first**: the initial client should not import every locale dictionary. See `docs/ARCHITECTURE.md` and `docs/RELEASE_POLICY.md` for the repository contract and promotion rules.
