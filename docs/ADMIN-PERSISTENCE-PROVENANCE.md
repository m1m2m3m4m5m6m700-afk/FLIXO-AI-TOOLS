# Admin Persistence Provenance

Status: BLOCKED / PRODUCTION BINDING REQUIRED

Exact repository state reviewed: `main @ 767a9a97f8088ad1ff736e186ba5d783751ddab2`
Contract: `docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md` v1.0

## Current repository proof

The repository contains a server-side Supabase REST persistence adapter at `api/admin/persistence.ts`, targeted round-trip coverage at `scripts/test-admin-persistence.mjs`, and the version-controlled ADMIN-006 persistence migration at `supabase/migrations/20260914040000_admin_006_persistence_evidence.sql`.

Observed repository facts:
- No database/ORM dependency is present in `package.json`.
- Persistence uses the existing server-side REST path with `SUPABASE_URL` plus `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.
- The adapter fails closed when persistence configuration is absent.
- The existing event path supports create + exact UUID read-back for `public.flix_events`.
- ADMIN-006 includes evidence and audit adapters with exact-SHA provenance, actor/target fields, integrity SHA-256, and evidence↔audit linkage.
- No production Admin mutation path is enabled.

## Canonical provider discovery

The connected Supabase control plane exposes one project:
- Project: `m1m2m3m4m5m6m700-afk's Project`
- Project ref: `zrpsmgdrtwzrhkjwwujo`
- Region: `eu-west-1`
- Postgres engine: `17`
- Status: `ACTIVE_HEALTHY`

Direct schema discovery confirms:
- `public.flix_events`
- `public.flix_admin_sessions`
- `public.flix_admin_evidence`
- `public.flix_admin_audit_events`

The ADMIN-006 evidence/audit tables have RLS enabled. Public `anon`/`authenticated` roles have no table privileges; `service_role` retains the required server-side privileges.

This confirms that the existing Supabase project is the canonical persistence candidate and that a parallel database must not be created.

## Production binding proof

The repository contract records:
- Production origin: `https://flixoai.vercel.app`
- Vercel team id: `team_LgeIYyf9ERfG3gNswQO4MiPX`
- Vercel project id: `prj_FdFbUWMAZepEfvwhttAiLcYJqY0d`

Current Vercel control-plane verification:
- Team `flexo1` / `team_LgeIYyf9ERfG3gNswQO4MiPX` is visible.
- The team's project listing returns zero projects.
- Direct lookup of the documented production project returns `403/404` access/not-found behavior.
- Production runtime log access for the documented project is rejected with `403` because the project is unavailable to the connected control plane.

Therefore the server-side production binding between the documented Vercel deployment and Supabase project `zrpsmgdrtwzrhkjwwujo` is NOT PROVEN. The Vercel team connection itself is proven; project-level access/binding is not.

## Current ADMIN-006 execution state

Implemented inside the repository:
- persistence schema migration
- evidence and audit server adapter
- exact-SHA integrity fields
- evidence-to-audit linkage
- positive round-trip regression coverage
- fail-closed configuration behavior

CI evidence on `main @ 767a9a97f8088ad1ff736e186ba5d783751ddab2`:
- Dependency Usage Classification v2: `SUCCESS`
- Dependency Health Inventory: `SUCCESS`
- FLIXO Test System: was running at last observation; no failure evidence was established.

ADMIN-006 is therefore still open because closure requires fresh exact-SHA CI/certification and proven production Vercel-to-Supabase binding.

## Required unblock proof

1. Prove that `zrpsmgdrtwzrhkjwwujo` is the persistence provider for the production Vercel deployment.
2. Prove the server-side environment binding without exposing secret values.
3. Reuse the existing provider and persistence path.
4. Prove server write -> read-back on the exact tested SHA.
5. Prove actor and exact-target provenance and audit completeness.
6. Preserve fail-closed behavior for absent/unavailable persistence.

## Forbidden shortcuts

- No fake or in-memory production persistence.
- No second database stack.
- No guessed Supabase project binding.
- No client-side database credentials.
- No production mutation before binding and authorization proof.
- No GREEN/COMPLETE claim without exact-SHA write/read-back evidence.
