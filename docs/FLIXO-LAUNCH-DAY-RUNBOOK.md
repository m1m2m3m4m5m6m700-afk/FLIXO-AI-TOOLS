# FLIXO Launch-Day Runbook

## T-24h

1. Freeze the release candidate.
2. Record the exact candidate SHA in `docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md`.
3. Verify required CI, security, Red Team, and browser evidence.
4. Verify production rollback target.
5. Verify analytics/monitoring configuration without collecting user image bytes.
6. Verify all public copy against the candidate capability registry.
7. Freeze feature scope.

## T-1h

- Production health check.
- Browser smoke on desktop and mobile.
- Verify landing -> editor -> upload -> agent/manual -> execute -> verify -> export.
- Verify production immutable identity.
- Verify support/security reporting path.
- Verify launch assets.

## T0

Publish only after the release gate is green on one exact SHA.

Sequence:
1. Production release.
2. GitHub release/tag.
3. Website launch announcement.
4. Product Hunt / HN / community distribution.
5. Social posts.
6. Email announcement.

## T+1h to T+6h

Monitor:
- landing views
- editor opens
- first successful edits
- execution failures
- verification failures
- export failures
- latency
- client/runtime errors
- security alerts

Do not expand product scope during the launch peak.

## T+24h

Publish a factual launch report:
- traffic
- activation
- successful edit rate
- export success rate
- incidents
- top failure modes
- top acquisition sources
- user feedback
- fixes deployed

## Incident protocol

Detect -> Contain -> Rollback/Disable -> Verify -> Communicate -> Fix -> Regression -> Redeploy.

Every production fix must produce fresh exact-SHA evidence before being called resolved.
