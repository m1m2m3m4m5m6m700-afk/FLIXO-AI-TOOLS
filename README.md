# FLIXO AI

FLIXO AI is a browser-first AI toolbox built with React 19, Vite, TypeScript, TanStack Router, and Cloudflare Workers assets.

## Architecture

- `src/config` — origin and product configuration.
- `src/lib/i18n` — the exact 20-locale contract and lazy translation loading.
- `src/lib/routing` — pure localized route resolution.
- `src/lib/seo` — canonical URLs, hreflang, JSON-LD, and breadcrumb generation.
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

`wrangler.jsonc` defines the canonical Cloudflare production deployment at `https://flixoai.m1m2m3m4m5m6m700.workers.dev`. Vercel remains a compatibility environment and is not the canonical production origin.

Provider and database credentials remain server-side. Never expose secrets through `VITE_*` variables.

## Public launch

The launch program is tracked in `docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md` and release truth is recorded in `docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md`.

Launch operation documents:
- `docs/FLIXO-LAUNCH-DAY-RUNBOOK.md`
- `docs/FLIXO-ANALYTICS-CONTRACT.md`
- `docs/FLIXO-TRUST-AND-OPERATIONS.md`
- `docs/FLIXO-LAUNCH-DISTRIBUTION-PACK.md`
- `docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md`

A public launch is not certified merely because the application builds. CI, security, Red Team, production identity and browser evidence must bind to the same exact release SHA.
