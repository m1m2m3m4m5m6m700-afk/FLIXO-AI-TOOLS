# Admin Persistence Provenance

Status: BLOCKED / PROVENANCE REQUIRED

Exact repository candidate: `main @ cf220096386489dfc9952a9ccc2d645e1a335eba`

## Current proof

The current FLIXO repository does not contain a proven production persistence implementation.

Observed repository facts:
- No database/ORM dependency is present in `package.json`.
- Repository search finds no Supabase/Postgres/Drizzle connection or client implementation.
- `.env.example` contains no production database binding.
- The current Admin server boundary is fail-closed and does not invent a persistence provider.

## External provider discovery

The connected Supabase account exposes one project:
- Project: `m1m2m3m4m5m6m700-afk's Project`
- Project ref: `zrpsmgdrtwzrhkjwwujo`
- Region: `eu-west-1`
- Status: `INACTIVE`
- Created: `2026-09-04`

This project is NOT treated as FLIXO Production Persistence because ownership/environment binding to the deployed FLIXO application has not been proven.

The connected Vercel control plane also cannot currently prove the project binding: the repository's CD contract contains Vercel project identifiers, but the connected Vercel API returns `404` for the project lookup and `403` for deployment listing. Therefore no database environment variable or production binding can be asserted from the available control-plane evidence.

## Required proof before implementation

1. Identify the canonical production persistence provider.
2. Prove that the provider belongs to the FLIXO production environment.
3. Prove the server-side environment binding without exposing credentials.
4. Inspect the existing schema before adding any tables.
5. Reuse the canonical provider; do not create a second store.
6. Add Admin principals/roles/capabilities, audit events, and evidence records only after provenance is proven.
7. Prove server write -> read-back on the exact tested SHA.
8. Preserve fail-closed behavior for absent/unavailable persistence.

## Forbidden shortcuts

- No fake or in-memory production persistence.
- No second database stack.
- No guessed Supabase project binding.
- No client-side database credentials.
- No GREEN/COMPLETE claim without exact-SHA write/read-back evidence.
