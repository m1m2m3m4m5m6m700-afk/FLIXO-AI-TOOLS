# FLIXO Architecture

FLIXO is a React + Vite + TypeScript application. The built `dist` directory is deployable through Wrangler and remains compatible with the existing Vercel Vite deployment.

```text
Browser
  |
  +-- Router
  |     +-- localized pages
  |     +-- tool pages
  |     +-- agent UI
  |
  +-- src/lib
  |     +-- i18n
  |     +-- routing
  |     +-- seo
  |     +-- agent
  |
  +-- src/tools
  |     +-- isolated tool engines
  |
Server
  |
  +-- api/flixo-agent.ts
  +-- api/admin/*
  +-- src/server/*
  +-- Supabase persistence
```

The main contracts are deliberately small:

1. `src/lib/i18n/config.ts` owns canonical locale identity.
2. `src/lib/routing/route-resolver.ts` owns localized tool paths.
3. `src/lib/seo` derives canonical URLs and alternate-language metadata from the same route/locale source.
4. Image upload safety is checked before expensive browser processing.
5. Mathematical expressions are parsed by a deterministic grammar; arbitrary JavaScript evaluation is forbidden.
6. Tools remain isolated under `src/tools`.

Locale dictionaries and heavyweight optional tools are lazy-first. The initial shell must not import every locale or expensive engine.

Verification is provided by TypeScript, ESLint, deterministic core contracts, production build output, and Playwright browser tests. Generated diagnostics and autonomous repair systems are not release authorities.
