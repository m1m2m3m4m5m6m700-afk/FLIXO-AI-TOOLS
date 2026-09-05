# FLIXO Architecture

## 1. Production source of truth

`main` is the only production source of truth. Feature, chore, experimental, diagnostic, repair, and historical branches are development/evidence inputs only. Valuable historical work must be rebuilt against current `main` before promotion.

## 2. System layers

```text
Browser
  |
  v
src/main.tsx
  |
  v
TanStack Router
  |
  +--> Root Layout / shared metadata / global UI
  |
  +--> Route modules
        |
        +--> localized pages
        +--> tool pages
        +--> isolated features

Shared infrastructure
  +--> src/lib/i18n
  +--> src/lib/diagnostics
  +--> src/config
  +--> src/services
  +--> src/data

Verification
  +--> deterministic checks
  +--> release verification
  +--> browser evidence
  +--> promotion decision
```

Each layer has a single responsibility:

| Layer | Purpose | Classification |
| --- | --- | --- |
| Production | user-facing runtime and release source | Production |
| Verification | proves contracts and build correctness | Verification |
| Diagnostics | explains failures and preserves evidence | Diagnostic |
| Experiments | isolated trials and dependency tests | Experimental |

Diagnostics and experiments must not silently become release truth.

## 3. Client-loading rule

The initial client should contain only what is needed to render the current route. Locale dictionaries and optional feature modules are **lazy-first** resources.

A static import of every locale or an expensive optional feature from a production entry point is an architecture regression because it converts route-specific functionality into initial-load cost.

The supported i18n shape is:

- `src/lib/i18n/config.ts` — locale identifiers, metadata, normalization, and site origin.
- `src/lib/i18n/types.ts` — shared translation contracts/types.
- `src/lib/i18n/locales/<locale>.ts` — the actual locale dictionary.
- `src/lib/i18n/loader.ts` — the runtime dictionary loader with dynamic imports and Promise caching.

## 4. Feature boundaries

Feature implementations stay isolated. Shared infrastructure may expose stable contracts, but it should not import feature implementations merely to make them available.

QuickFlow is deterministic-first. AI Planner is an optional refinement layer and must preserve deterministic fallback behavior.

Optional or expensive features should be code-split at the route/feature boundary. AI flows, charts, and other non-critical capabilities must not become unconditional dependencies of the landing shell.

## 5. SEO and metadata

SEO metadata is route-aware. Canonical, localized, and sitemap behavior must use the configured production origin and must not silently invent a production URL. `VITE_SITE_URL` is the deployment-time source for the final origin when SEO generation requires it.

## 6. Verification and evidence

`npm run check` is the deterministic repository/build gate. `npm run verify` is the release-oriented code gate. Browser tests and the full browser matrix provide UI/runtime evidence.

The promotion decision is based on fresh evidence for the exact commit being promoted. Local success and stale CI are not release certification.

## 7. What is not allowed

- Direct development changes to `main`.
- Loading all locale dictionaries in the initial application bundle.
- Importing optional AI/expensive feature code into the initial landing shell without evidence that it is required.
- Reintroducing legacy product catalogs or tools through convenience imports.
- Treating diagnostics as a second definition of GREEN.
- Mixing experimental branch assumptions into `main` without rebuilding and verifying against current production state.
- Deleting historical material solely for cleanliness.
