# MASTER REPAIR ENGINE v2

Protocol: FLIXO-MASTER-REPAIR-ENGINE-v2

Runtime: `scripts/ci/master-repair-engine.mjs`

## Capabilities

The Master Repair role now has a concrete repository I/O surface:

- READ: exact-SHA file reads, repository scan, import/dependency graph, and dependency blast-radius analysis.
- ANALYZE: stale-state rejection, external-provider isolation, evidence gating, and explicit NO_REPAIR decisions.
- SIMULATE: delegates candidate simulation to the existing bounded repair-engineering and sandbox pipeline.
- WRITE: bounded writes on `execution` only, using an exact-SHA fence, declared paths, automatic snapshots, gate-weakening rejection, and automatic rollback.
- VERIFY: optional allow-listed checks can execute after mutation; a failed check restores the pre-write snapshot.
- CLOSURE: successful writes remain `WRITTEN_PENDING_CANONICAL_GREEN`; the engine never certifies itself and never declares Canonical GREEN.

## Write contract

A source mutation plan must contain:

`taskId + failureFingerprint + runId + targetSha + allowedPaths + writes + evidence`

Hard stops include stale SHA, dirty worktree, missing evidence, undeclared paths, tests, main, control-plane files, gate weakening, oversized change sets, and failed post-write checks.

The engine is the programmable read/write execution surface. Certification and Canonical GREEN remain external authorities.
