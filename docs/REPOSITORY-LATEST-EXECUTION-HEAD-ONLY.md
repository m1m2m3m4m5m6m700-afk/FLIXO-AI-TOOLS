# Repository Policy — Latest-Execution-HEAD-Only

**Legacy Rule ID:** `LATEST-EXECUTION-HEAD-ONLY-001`  
**Superseded by:** `LATEST-COMMIT-ONLY-002`  
**Scope:** repository-wide

The repository-wide authority is now defined by `docs/REPOSITORY-LATEST-COMMIT-ONLY.md`.

The live tip of each canonical branch is authoritative. When a canonical branch advances, every active run tied to an older SHA is subject to repository-wide supersession cancellation, and every exact-SHA gate rejects the older SHA.

This document remains as the historical execution-branch policy record. It does not grant an exception to the repository-wide latest-commit-only rule.

## Historical execution cleanup

`.github/workflows/latest-execution-head-cleanup.yml` and `scripts/ci/latest-execution-head-cleanup.mjs` remain responsible for retention cleanup of obsolete execution-branch runs and artifacts. Cleanup is operational retention; it is not the authority for deciding whether a SHA is current.

## Race safety

A cancellation race does not create valid evidence. The mandatory exact live-head guard fails closed when the branch tip has moved.

Completed historical workflow runs cannot be retroactively converted to GitHub status `cancelled`; they remain historical records and are non-authoritative for current certification.
