# FLIXO Architecture

## Source of truth

`main` is the production source of truth. Experimental branches, historical PRs, diagnostic branches, and repair snapshots are evidence or development inputs only; they are not production unless their changes are deliberately rebuilt on current `main` and pass the current gates.

## Runtime layers

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
        +--> other isolated features

Shared infrastructure
  +--> src/lib/i18n
  +--> src/lib/diagnostics
  +--> src/config
  +--> src/services
  +--> src/data
```

## Client-loading rule

The initial client should contain only what is needed to render the current route. Locale dictionaries and optional feature modules are **lazy-first** resources. A static import of every locale or optional feature is considered an architecture regression because it converts route-specific code into initial-load cost.

The supported i18n shape is:

- `src/lib/i18n/config.ts` — locale identifiers, language metadata, normalization, and site origin.
- `src/lib/i18n/locales/<locale>.ts` — the actual locale dictionary.
- `src/lib/i18n/loader.ts` — the only runtime loader for dictionaries, with Promise caching and explicit preload support.

## Feature boundary

Feature code must remain isolated from the shared layer. Shared infrastructure may expose stable contracts; it should not import feature implementations merely to make them available.

Optional or expensive features should be code-split at the route/feature boundary. Quick actions, AI flows, charts, and other non-critical capabilities must not become unconditional dependencies of the landing shell.

## SEO and metadata

SEO metadata is route-aware. Canonical, localized, and sitemap behavior must use the configured production origin and must not silently invent a production URL. `VITE_SITE_URL` is the deployment-time source for the final origin when SEO generation requires it.

## Diagnostics versus release truth

Diagnostics explain failures and preserve evidence. They do not create a second definition of "green". The release decision is based on the canonical verification contract and fresh CI results for the exact commit.

## What is not allowed

- Reintroducing deleted legacy product catalogs or tools through convenience imports.
- Loading all locale dictionaries in the initial application bundle.
- Treating a successful local run or a stale CI run as release evidence.
- Mixing experimental branch assumptions into `main` without rebuilding against current production state.
