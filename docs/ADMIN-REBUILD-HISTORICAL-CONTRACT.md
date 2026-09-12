# Admin Rebuild — Historical Contract

Status: CANDIDATE
Source baseline: `main @ fcf5f7be198f4b6b480c555deaf1253968a05fd1`

## Purpose

Rebuild the Admin capability only from historically successful, evidence-bearing contracts. This document is not a production Admin implementation and does not reactivate retired Admin routes, storage, or dependencies by itself.

## Historical evidence

### PR #5 — `feat/real-admin-data`

Successful historical implementation of the real-data foundation:

- PostgreSQL + Drizzle data access.
- Server-side RPC/server-function boundary.
- CSRF and rate-limit protection.
- Real analytics and operational data paths.
- Fail-closed `db_not_configured` behavior instead of fabricated success.
- Server-only handling of database credentials.

Historical reference: PR #5.

### PR #21 — `feat(admin): complete private analytics and survey control center`

Historical Admin product surface:

- private analytics/control-center surface;
- surveys;
- owner inbox/conversations;
- private indexing metadata.

PR #21 was superseded because the completed changes were applied directly to `main`; it is historical evidence, not a merge target.

### PR #399 — `feat(admin): add protected survey control center`

Successful historical protected Admin surface:

- Overview metrics.
- Survey CRUD and question builder.
- Response viewer and CSV export.
- Owner/Admin/Analyst role contract.
- Audit UI.
- `noindex`/`noarchive` metadata.
- Server-side password verification using scrypt.
- HTTP-only session.
- No admin secret in the browser bundle.

### PR #400 — `fix: repair Admin/TanStack Start CI regressions`

Historical hardening evidence:

- Server boundary for Admin auth crypto/session code.
- Correct Admin route registration.
- Unauthenticated redirect to `/admin/login`.
- Start/Vite server integration.
- Hydration/lint corrections.
- Login throttling without client-bundled server dependencies.

### PR #602 — `repair: close legacy graph after image pivot`

Historical removal evidence. The following are retired and must not be restored wholesale:

- Admin routes and route registrations.
- Browser Admin facade/store.
- Survey subsystem and prototype persistence.
- Legacy Admin auth/config facade.
- Admin styling/docs/helpers.
- Admin/DB/SMTP environment variables.

The removal was part of the Image-only architectural closure.

## Reusable contracts

Only the following are candidates for a new Admin implementation:

1. Server-only authentication boundary.
2. HTTP-only session semantics.
3. Explicit server-side role authorization.
4. Fail-closed authentication/configuration.
5. CSRF protection.
6. Login rate limiting.
7. Real-data-only analytics.
8. Auditability for privileged mutations.
9. Noindex/private Admin surface.
10. Existing repository database/RPC pattern, only if a server persistence layer is reintroduced and its current consumers are proven.

## Explicit exclusions

Do not restore:

- localStorage/browser Admin persistence;
- the historical route tree wholesale;
- historical Admin dependencies merely because they existed;
- a second database stack;
- duplicated test suites for each Admin feature;
- historical AI/PDF/media assumptions;
- legacy environment variables without current consumers.

## Current-main compatibility gate

Current `main` is a Vite + React + TypeScript + TanStack Router application. Its route tree currently contains the public product routes and no Admin routes. The repository's current architecture explicitly favors one registry/catalog and shared contract engines rather than bespoke administrative test suites.

Therefore an Admin rebuild must first establish its runtime/server boundary on current `main` before any UI restoration is considered valid.

## Activation rule

This contract remains `CANDIDATE` until an explicit implementation scope is activated. No Admin production capability is implied by this document.

## Certification rule

No Admin change may be called GREEN or STABLE without:

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`
