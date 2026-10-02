# FLIXO Trust & Operations

## Support

A public support contact must be configured before launch. Do not publish a fabricated address.

## Security disclosure

Security vulnerabilities must not be reported through public issue threads. The repository owner must enable an appropriate private GitHub vulnerability reporting path before public launch.

## Privacy claims

FLIXO is browser-first. Public copy must distinguish local browser processing from server-side gateway operations. Never claim that every feature is permanently local unless the exact capability has been verified as local.

## Incident severity

- P0: security breach, data exposure, destructive execution, or production-wide outage.
- P1: major execution failure affecting a core workflow.
- P2: degraded non-core capability or localized regression.
- P3: documentation/content/low-impact UX defect.

## Response

Detect -> Contain -> Rollback/Disable -> Verify -> Communicate -> Fix -> Regression -> Redeploy.

## Change control

Every production incident fix must be linked to:
- exact commit SHA
- test evidence
- browser verification where applicable
- production deployment identity
- post-deployment verification

Never close an incident using a stale SHA.
