# Admin Persistence Provenance

Status: BLOCKED / PROVENANCE REQUIRED

Exact repository state reviewed: `main @ 12d2c166bd895570ffe5c44a69c437b1c5925cfa`

## Current proof

The current FLIXO repository does not contain a proven production persistence implementation.

Observed repository facts:
- No database/ORM dependency is present in `package.json`.
- The lockfile root dependency set contains no database/ORM package.
- Repository code search does not establish a canonical Supabase/Postgres/Drizzle connection or client path.
- `.env.example` contains no production database binding. The canonical production origin is `https://flixoai.vercel.app`, but no database binding is declared there.
- The current Admin server boundary is fail-closed and does not invent a persistence provider.

## External provider discovery

The connected Supabase control plane exposes one project:
- Project: `m1m2m3m4m5m6m700-afk's Project`
- Project ref: `zrpsmgdrtwzrhkjwwujo`
- Region: `eu-west-1`
- Postgres engine: `17`
- Status: `INACTIVE`
- Created: `2026-09-04`

A direct schema/type discovery attempt against this project was rejected because the project is not active and healthy. Therefore this project is NOT treated as FLIXO Production Persistence.

The repository's canonical CD contract independently records the intended production Vercel identity:
- Production origin: `https://flixoai.vercel.app`
- Vercel team id: `team_LgeIYyf9ERfG3gNswQO4MiPX`
- Vercel project id: `prj_FdFbUWMAZepEfvwhttAiLcYJqY0d`

These identifiers establish the repository's intended deployment contract, but they do not by themselves prove control-plane ownership or server environment access. The connected Vercel team `flexo1` is confirmed as `team_LgeIYyf9ERfG3gNswQO4MiPX`, but its project listing currently returns zero projects. A direct deployment lookup for the documented project/team binding is denied with `403 Forbidden`. Therefore the currently connected Vercel credentials do not prove access to the documented production project or its server environment binding.

## Phase 2 execution result

Provider provenance discovery was executed against the current repository and connected hosting/database control planes. The required production provider could not be established without guessing.

Accordingly:
- No database, ORM, migration, or parallel store was created.
- No production credentials were exposed or inferred.
- No Admin write path was enabled.
- Fail-closed persistence posture is preserved.

## Required proof before implementation

1. Identify the canonical production persistence provider.
2. Prove that the provider belongs to the FLIXO production environment.
3. Prove the server-side environment binding without exposing credentials.
4. Inspect the existing schema before adding any tables.
5. Reuse the canonical provider; do not create a second store.
6. Add Admin principals/roles/capabilities, audit events, and evidence records only after provenance is proven.
7. Prove server write -> read-back on the exact tested SHA.
8. Preserve fail-closed behavior for absent/unavailable persistence.

## Current execution blocker

Phase 2 cannot truthfully advance to persistence implementation until provider provenance and server binding are established. The repository contains a canonical deployment contract, but the connected hosting control plane cannot currently authorize access to that documented project. No database, migration, ORM dependency, or production write path is being created on the basis of an unproven provider.

## Forbidden shortcuts

- No fake or in-memory production persistence.
- No second database stack.
- No guessed Supabase project binding.
- No client-side database credentials.
- No GREEN/COMPLETE claim without exact-SHA write/read-back evidence.
