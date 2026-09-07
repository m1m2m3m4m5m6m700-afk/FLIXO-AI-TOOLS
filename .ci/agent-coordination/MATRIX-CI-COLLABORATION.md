# Matrix + CI Collaborative Recovery Contract

## Active ownership

Agent `ci-matrix-recovery` owns the Matrix/CI recovery scope on branch `agent/ci-matrix/full-recovery`.

The prior `matrix-therapy-v2` session is released. Its documented Matrix work is treated as inherited input, not as concurrent write authority.

## Scope

Matrix orchestration, canonical Matrix First ownership, exact-SHA evidence, Playwright test identity, CI gating/cooperation, G1/G4 browser/runtime contracts, and coordination runtime integration.

## Collaboration rules

1. Never overwrite another active claim path, contract, or Root Cause ID.
2. Claims are anchored to an observed SHA; later commits remain valid while the anchor is an ancestor of the current branch tip.
3. SHA divergence or non-ancestor history requires re-ingestion before further writes.
4. The canonical certification authority is `Matrix First Certification` in `full-matrix-parallel.yml`.
5. Diagnostic workflows may investigate but do not become certification authorities.
6. Native Playwright evidence must match the signed plan exactly by browser, shard, suite, test identity, count, and status.
7. CI must fail closed on missing exact-head Matrix certification rather than substitute a different result.

## Current Root Causes

- RC-MATRIX-008
- RC-CI-002
- RC-CI-003
- RC-G4-MATRIX-001
- RC-G4-ROUTER-001

## Proof requirement

No release or merge claim is valid until the exact HEAD has fresh Matrix First certification and all downstream contract gates pass.
