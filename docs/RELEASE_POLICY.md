# FLIXO Release Policy

## 1. Production source

`main` is the only production branch. Work from older branches must be rebuilt or safely rebased onto current `main` before it can be considered for promotion.

## 2. Verification levels

### Development

Use targeted checks while editing:

```bash
npm run typecheck
npm run lint
```

### Repository check

`npm run check` is the deterministic repository/build gate. It covers the project's baseline, router registry, localization, SEO, build, and performance-budget checks defined in `package.json`.

### Full verification

`npm run verify` is the release-oriented gate. It includes the repository check and production dependency audit.

### Browser smoke

`npm run test:e2e` verifies the browser-facing contracts with Playwright.

## 3. Release evidence

A release candidate needs fresh evidence for the exact commit being promoted. The minimum evidence set is:

1. `npm run verify` passes.
2. Browser E2E smoke passes.
3. SEO/localization validation passes when those surfaces changed.
4. Production dependency audit passes.
5. Deployment smoke is green when a deployment is required by the release process.

Provider-side deployment limits, rate limits, or quota errors are operational conditions; they must not be misreported as code success or code failure without corresponding application evidence.

## 4. Pull request hygiene

- Close PRs that are explicitly temporary, marked "do not merge", or based on obsolete experimental branches.
- Rebuild valuable historical work on current `main` instead of merging stale histories wholesale.
- Keep dependency experiments isolated until their package, lockfile, type, build, and browser effects are proven.
- Keep one coherent PR per consolidation theme where possible; avoid mixing large refactors with unrelated feature work.

## 5. i18n contract

The runtime path is lazy-first. `src/lib/i18n/loader.ts` owns dictionary loading and Promise caching. New code must not add a static import of every locale to a production entry point.

When the i18n refactor is active, the required acceptance checks are:

- only the requested locale is loaded at runtime;
- the initial bundle does not contain every locale dictionary;
- locale fallback remains deterministic;
- localized routing and SEO continue to work for all configured locales.

## 6. Promotion rule

No release is called "green", "certified", or "production-ready" without current CI evidence for the exact commit. Local success is useful development evidence, not release certification.
