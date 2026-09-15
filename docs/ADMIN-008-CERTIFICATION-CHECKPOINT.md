# ADMIN-008 Certification Checkpoint

Status: ACTIVE / NOT VERIFIED

## Current release candidate

The certification cycle starts from the exact `main` SHA produced by this checkpoint commit.

Required proof remains fail-closed:

- exact-SHA full CI and certification;
- production deployment for the same certified SHA;
- Vercel exact-SHA production read-back;
- security/configuration proof;
- product/routing/i18n proof;
- SEO/performance proof;
- observability/error-memory proof;
- rollback reference;
- final task/project evidence.

Production mutation remains disabled until all mandatory gates are proven.

Known external blocker: the connected Vercel control plane currently exposes the FLIXO team but no project, so production deployment identity cannot yet be independently verified.
