# FLIXO — SHARED OPERATIONAL MEMORY CONTRACT

Contract ID: CELL-SHARED-OPERATIONAL-MEMORY-001
Version: 1.0.0
Status: MANDATORY
Scope: 200 CELL Bots + Master Council + registered agents

## Canonical memory

Path: `diagnostics/auto-repair/cell-knowledge/index.json`

`CELL_KNOWLEDGE_INDEX` is the single canonical operational learning index for the cell.

Personal Bot memory may exist for local continuity, but it is not the canonical shared memory.

## Required learning lifecycle

`OBSERVE → CAPTURE → RCA → EVIDENCE → VALIDATE → MASTER_REVIEW → MEMORY_COMMIT → PUBLISH → CELL_BROADCAST → BOT_SYNC → REUSE → REASSESS`

## Publication gate

Learning becomes cell-wide knowledge only when the record is validated, bound to provenance and Exact-SHA, and published through the canonical shared memory path.

Unproven learning must not enter the published shared memory.

## Distribution

The contract applies to all 200 CELL bots.

Every published learning record receives a canonical memory version. Bots track whether they are `CURRENT`, `SYNC_PENDING`, `STALE`, or `SYNC_FAILED`.

Any Bot that is behind the canonical memory version must synchronize before relying on newly published knowledge.

## Integrity

Published knowledge requires content integrity, source provenance and an auditable publication event.

If knowledge conflicts, the Bot must not choose arbitrarily. The conflict is routed through Master-2 and Master-3 and then Master-1 for operational resolution.

## Invalidation

Source SHA change, failed reuse, or a formal challenge causes revalidation before continued reuse.

Historical knowledge is not current GREEN evidence.

## Authority boundary

Shared knowledge never grants mutation authority, certification authority, permission escalation or command authority.

## Bot obligation

Every Bot must:

1. Search the canonical shared memory when relevant before rediscovering a known failure.
2. Publish validated generalizable learning through the canonical path.
3. Synchronize to the latest canonical memory version.
4. Verify provenance and integrity before reuse.
5. Record reuse outcomes and new feedback.
6. Challenge incorrect knowledge rather than silently overwriting it.

## Cell law

**LEARN ONCE → VALIDATE ONCE → PUBLISH ONCE → MAKE AVAILABLE TO ALL 200 → REUSE → FEEDBACK → REASSESS**

**KNOWLEDGE IS SHARED; AUTHORITY REMAINS CONTROLLED.**
