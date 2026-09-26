# FLIXO AI

FLIXO AI is a browser-first AI toolbox built with React 19, Vite, TypeScript, TanStack Router, and Cloudflare Workers assets.

## Architecture

- `src/config` — origin and product configuration.
- `src/lib/i18n` — the exact 20-locale contract and lazy translation loading.
- `src/lib/routing` — pure localized route resolution.
- `src/lib/seo` — canonical URLs, hreflang, JSON-LD, and breadcrumb generation.
- `src/lib/agent` — deterministic AI engines and conversation/runtime infrastructure.
- `src/tools` — isolated user-facing tools.
- `api` — server-side gateways and protected admin endpoints.
- `supabase` — active persistence configuration only.

Legacy repair swarms, council runtimes, autonomous repair controllers, generated diagnostic ledgers, and duplicated governance layers are not part of production.

## Internationalization

The canonical locales are exactly:

`ar`, `en`, `es`, `fr`, `de`, `hi`, `id`, `it`, `ja`, `ko`, `ms`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `uk`, `vi`.

Arabic (`ar`) is the default locale.

## Core commands

```bash
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

The production build generates `robots.txt`, `sitemap.xml`, and physical SPA route entries.

## Deployment

`wrangler.jsonc` defines the Cloudflare asset deployment. `vercel.json` remains compatible with the existing Vercel Vite environment.

Provider and database credentials remain server-side. Never expose secrets through `VITE_*` variables.
