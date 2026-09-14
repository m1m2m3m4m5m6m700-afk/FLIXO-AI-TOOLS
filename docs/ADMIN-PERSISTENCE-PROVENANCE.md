# Admin Persistence Provenance

Status: BLOCKED / PRODUCTION BINDING REQUIRED

Exact repository state reviewed: `main @ f83ca490f68f43923cfd225adfc6ae976ff23638`
Contract: `docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md` v1.0

## Current repository proof

The repository already contains a server-side Supabase REST persistence adapter at `api/admin/persistence.ts` and a targeted round-trip contract test at `scripts/test-admin-persistence.mjs`.

Observed repository facts:
- No database/ORM dependency is present in `package.json`.
- Persistence is currently implemented through server-side REST access using `SUPABASE_URL` plus `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.
- The adapter fails closed when persistence configuration is absent.
- The adapter supports create + exact UUID read-back for `public.flix_events`.
- No production Admin mutation path is enabled.

## Canonical provider discovery

The connected Supabase control plane currently exposes one project:
- Project: `m1m2m3m4m5m6m700-afk's Project`
- Project ref: `zrpsmgdrtwzrhkjwwujo`
- Region: `eu-west-1`
- Postgres engine: `17`
- Status: `ACTIVE_HEALTHY`

Direct schema discovery is now available and confirms the existing public tables:
- `public.flix_events`
- `public.flix_admin_sessions`

`public.flix_events` contains UUID identity, timestamps, event classification, actor/visitor context, optional tool and outcome fields, and JSONB metadata. `public.flix_admin_sessions` contains hashed session token, creation/expiry, and last-seen timestamps.

This establishes that the connected Supabase project is a viable persistence candidate and that a parallel database must not be created.

## Production binding proof

The repository's canonical deployment contract records:
- Production origin: `https://flixoai.vercel.app`
- Vercel team id: `team_LgeIYyf9ERfG3gNswQO4MiPX`
- Vercel project id: `prj_FdFbUWMAZepEfvwhttAiLcYJqY0d`

The connected Vercel control plane currently lists zero projects for the documented team, and a direct lookup of the documented project/team binding returns `404 Not Found`.

Therefore the server-side production environment binding between the documented Vercel project and the Supabase project is NOT PROVEN. The Supabase project is not to be treated as production persistence until that binding is independently verified.

## Phase 2 execution result

Provider/schema discovery is no longer blocked by the Supabase project being inactive. The remaining blocker is production binding provenance.

Accordingly:
- Do not create a second database, ORM, migration set, or guessed provider binding.
- Do not expose or infer production credentials.
- Do not enable production Admin writes.
- Preserve fail-closed behavior until the production binding is proven.

## Required unblock proof

1. Prove that `zrpsmgdrtwzrhkjwwujo` is the persistence provider for the production Vercel deployment.
2. Prove the server-side environment binding without exposing secret values.
3. Reuse the existing `public.flix_events` / `public.flix_admin_sessions` provider if the binding is confirmed.
4. Extend the existing persistence path only as required by ADMIN-006's approved v1.0 contract.
5. Prove server write -> read-back on the exact tested SHA.
6. Prove actor and exact-target provenance and audit completeness.
7. Preserve fail-closed behavior for absent/unavailable persistence.

## Forbidden shortcuts

- No fake or in-memory production persistence.
- No second database stack.
- No guessed Supabase project binding.
- No client-side database credentials.
- No production mutation before binding and authorization proof.
- No GREEN/COMPLETE claim without exact-SHA write/read-back evidence.
