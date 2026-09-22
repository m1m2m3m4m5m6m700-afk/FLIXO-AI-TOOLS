# FLIXO Shared Operational Memory Contract

## Identity

CELL-SHARED-OPERATIONAL-MEMORY-001

This contract remains the canonical descriptive interface for shared operational memory referenced by P21. The former CELL-001..CELL-200 worker pool is retired; `diagnostics/auto-repair/cell-knowledge/index.json` is retained only as the retirement record.

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

The retired cell index preserves the historical synchronization states for compatibility and audit:

- CURRENT
- SYNC_PENDING
- STALE
- SYNC_FAILED

Any retained sync record preserves source SHA, memory version, provenance, and publication state; no CELL-001..CELL-200 identity may be reprovisioned.

## Safety boundary

knowledge does not grant authority.

Exact-SHA evidence, Control Plane admission, Repair Protocol mutation gates, regression evidence, and Canonical GREEN remain authoritative.
