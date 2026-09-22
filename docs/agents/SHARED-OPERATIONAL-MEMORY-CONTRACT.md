# FLIXO Shared Operational Memory Contract

## Identity

CELL-SHARED-OPERATIONAL-MEMORY-001

This is the canonical descriptive contract for the 200-cell-bot operational knowledge index referenced by P21. The runtime source of truth is `diagnostics/auto-repair/cell-knowledge/index.json`.

## Authority

CELL_KNOWLEDGE_INDEX

Shared memory is reusable information only. It never grants mutation, certification, permission, command, merge, or policy-override authority.

## Publication

CELL_MEMORY_UPDATED

A memory record may be published only after validation, provenance, and exact-SHA binding. Unproven learning remains local/provisional and may not be promoted.

## Versioning

memoryVersion is monotonically assigned to published knowledge. A source-SHA change invalidates immediate reuse until the record is requalified.

## Conflict handling

MEMORY_CONFLICT

Conflicting knowledge remains visible and blocking until current exact-SHA evidence resolves the conflict. Historical success cannot override fresh contrary evidence.

## Distribution

The canonical index is synced to the 200-cell-bot pool with explicit states:

- CURRENT
- SYNC_PENDING
- STALE
- SYNC_FAILED

Every sync record preserves source SHA, memory version, provenance, and publication state.

## Safety boundary

knowledge does not grant authority.

Exact-SHA evidence, Control Plane admission, Repair Protocol mutation gates, regression evidence, and Canonical GREEN remain authoritative.
