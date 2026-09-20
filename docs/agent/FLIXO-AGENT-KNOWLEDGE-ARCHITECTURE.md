# FLIXO Agent — Knowledge Architecture v1

## Session 1 scope

This document defines the bounded foundation for the embedded FLIXO Agent knowledge system.

### Design goals

- Knowledge must be source-backed, versioned, fingerprinted, and freshness-aware.
- Retrieval must support hybrid strategies; embeddings alone are insufficient.
- The agent must distinguish verified facts, inference, uncertainty, and conflicts.
- Existing capability/planner contracts remain the execution source of truth.
- Session 1 introduces contracts only; it does not grant new execution permissions.

## Three-session delivery plan

### Session 1 — Knowledge Foundation
- AGENT-KNOWLEDGE-000: baseline and architecture inventory.
- AGENT-KNOWLEDGE-001: Knowledge Fabric contracts.
- AGENT-KNOWLEDGE-002: hybrid retrieval contract and deterministic ranking interface.
- Establish validation and regression tests.

### Session 2 — Knowledge Expansion
- AGENT-KNOWLEDGE-003: knowledge graph.
- AGENT-KNOWLEDGE-004: source authority and conflict detection.
- AGENT-KNOWLEDGE-005: ingestion/update pipeline.
- AGENT-KNOWLEDGE-006: layered memory with privacy/retention controls.

### Session 3 — Cognitive Agent
- AGENT-KNOWLEDGE-007: evidence-based answering.
- AGENT-KNOWLEDGE-008: planning/reasoning.
- AGENT-KNOWLEDGE-009: tool intelligence.
- AGENT-KNOWLEDGE-010: learning loop.
- AGENT-KNOWLEDGE-011: supervisor/fail-closed controls.
- AGENT-KNOWLEDGE-012: evaluation lab.
- AGENT-KNOWLEDGE-013: continuous evolution.

## Knowledge lifecycle

```
SOURCE → NORMALIZE → RECORD → INDEX → RETRIEVE → RERANK
      → VERIFY → ANSWER/ACT → VALIDATE → LEARN
```

Every transition must retain provenance and a deterministic fingerprint.

## Non-goals for Session 1

- No automatic web ingestion.
- No autonomous model fine-tuning.
- No new production credentials.
- No direct execution authority.
- No deletion of historical knowledge.
- No replacement of the canonical tool registry.
