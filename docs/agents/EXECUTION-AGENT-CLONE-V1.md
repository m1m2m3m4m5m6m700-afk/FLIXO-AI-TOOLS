# FLIXO — Execution Agent Clone v1

## Identity
- Clone: `execution-agent-clone-v1`
- Preserved runtime role: `executionAgent`
- Clone type: cognitive clone only.
- The clone does not create a second brain, registry, authority plane, or branch.

## Cognitive model

`execution-agent-clone-v1` and every active FLIXO agent/bot consume the same:

- `FLIXO-BOT-BRAIN-v1`
- `docs/agents/FLIXO-BOT.json#/mergedIntelligence`
- `FLIXO-SHARED-OPERATIONAL-MEMORY-v1`
- `diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json`

This is a **live shared-by-reference cognitive mesh**.

### Direction 1 — clone → everyone
Any learning produced by the clone that passes the shared-memory contract is published once into the canonical shared memory and becomes visible to all active learning consumers.

### Direction 2 — everyone → clone
All published operational knowledge from active agents/bots is returned to the clone through the shared learning context. The clone therefore receives the collective learning stream rather than a private local copy.

## What is cloned

The clone receives the common capability set and common learning context. Specialization remains a role overlay.

## What is not cloned

Authority is not copied through intelligence. Mutation, certification, merge, chair ownership, dispatch and protected-control-plane permissions remain governed by the existing control plane and exact-SHA protocols.

## Exact-SHA rule

Every useful learning record remains exact-SHA-bound and provenance-bound. A new push invalidates prior evidence for the new head until revalidated.

## Retired pool rule

This integration expands the active shared-intelligence audience only. It does **not** reactivate or recreate the retired CELL-001..CELL-200 worker pool.
