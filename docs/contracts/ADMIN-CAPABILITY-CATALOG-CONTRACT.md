# FLIXO Admin Capability Catalog Contract

Status: ACTIVE / FOUNDATION HARDENING

## Purpose
Define one canonical vocabulary for Admin capabilities so the browser model, server boundary, module registry, and future policy engine cannot silently drift.

## Rules
1. Capabilities are authorization identifiers, not UI labels.
2. Server-side authorization is authoritative; browser declarations never grant access.
3. Unknown capabilities MUST fail closed.
4. Production mutation capabilities remain unavailable until their server policy/evidence contracts are proven.
5. A capability may be declared before runtime activation, but activation requires explicit server implementation and tests.
6. Do not create aliases by string similarity; compatibility aliases must be deliberate.

## Foundation catalog
- `admin.read`
- `truth.read`
- `evidence.read`
- `security.read`
- `contracts.read`
- `operations.read`
- `incidents.manage`
- `changes.read`
- `approvals.review`
- `users.manage`
- `deployments.preview`
- `deployments.execute`
- `system.rollback`
- `system.read`
- `audit.read`
- `production.write` (legacy compatibility identifier; LOCKED)

## Activation rule
Adding a capability to a TypeScript union or catalog does not activate it. Every activated capability requires server-side authorization coverage, positive and negative tests, policy classification, evidence/audit requirements, exact-SHA proof, and production verification where applicable.

Until those conditions are proven, the capability remains DECLARED/LOCKED.
