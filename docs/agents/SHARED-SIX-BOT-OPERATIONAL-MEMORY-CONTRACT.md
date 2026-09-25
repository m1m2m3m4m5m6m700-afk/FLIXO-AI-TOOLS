# FLIXO BOT — SYSTEM-WIDE SHARED INTELLIGENCE & OPERATIONAL MEMORY

Protocol: `FLIXO-SHARED-OPERATIONAL-MEMORY-v1`

Canonical brain registry: `docs/agents/FLIXO-BOT.json`

Canonical store:

`diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json`

## Participants

`ACTION-REPAIR` ↔ `ACTION-REPAIR-2`

`READ-INVESTIGATOR` ↔ `READ-ADVERSARY`

`executionAgent` ↔ `reviewAgent`

`execution-agent-clone-v1` is an active cognitive clone with preserved role `executionAgent`.

Every published record is visible to every active FLIXO BOT learning consumer, including `execution-agent-clone-v1`, and remains exact-SHA-bound to its provenance. The historical six-bot set remains a compatibility subset.

## Memory classes

ERROR → observed failures and fingerprints.

OPERATION → what happened during execution/repair/read/review.

ADVICE → reusable operational guidance.

OBLIGATION → required checks, constraints, or proof obligations.

LESSON → learning from successful or verified cycles.

ANTI_LESSON → failed strategies, counterexamples, stale assumptions, or unsafe approaches.

COUNTEREXAMPLE → evidence that challenges a current hypothesis or repair.

VERIFICATION → verification evidence and outcomes.

## Rules

The shared memory is knowledge, not authority.

Exact target SHA is mandatory for every new record.

Shared memory cannot grant mutation, certification, merge, dispatch, or permission authority.

A memory record marked VERIFIED does not by itself certify GREEN; current Exact-SHA canonical CI remains authoritative.

Every write to the canonical memory is immediately visible to all 200 cell members because they read the same store; no agent-to-agent propagation step is required.

Repair failures and counterexamples are retained so execution can avoid repeating them.

Read-side findings are fed back so repair, execution, security and review can avoid incorrect analysis and selection.

Execution/review/security/runtime findings are fed back so every role can avoid recurrence.

Legacy Action/Cell memories remain context-only read-through sources during migration and do not become a second authority for new learning.

No third branch is created for memory synchronization. Knowledge is shared by reference; authority is never cloned.

## FLIXO BOT invariant

All active consumers listed in `docs/agents/FLIXO-BOT.json` use the same core intelligence and canonical learning stream. Role, mutation, certification, security and transport permissions remain separate.


## Execution Agent Cognitive Clone

Protocol: `FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1`

Clone: `execution-agent-clone-v1`

Preserved role: `executionAgent`

The clone consumes the same `FLIXO-BOT-BRAIN-v1` capability set and the same canonical shared operational memory as every active agent/bot. It is synchronized by reference, not by duplicated local memory files.

**Clone → all:** eligible lessons, anti-lessons, counterexamples, verification and operational findings published by the clone enter the canonical shared memory and become visible to every active learning consumer.

**All → clone:** all published shared learning from active agents/bots is exposed to the clone through the system-wide shared learning context.

Knowledge is shared; authority is not. Mutation, certification, merge, dispatch and chair ownership remain governed by the existing control plane and exact-SHA contracts.


## External UI Agent Learning Bridge

Protocol: `FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1`

The external FLIXO UI agent `execution-agent-clone-v1` is connected to the same canonical learning stream through the durable server-side table `public.flixo_agent_learning_events`.

**Internal → external:** verified/promoted exact-SHA learning is mirrored into the durable table and is supplied to the external agent on subsequent conversations.

**External → internal:** the external agent may emit a bounded `PROPOSED` learning candidate. CI sync imports only candidates bound to the current exact SHA into canonical shared operational memory. Proposed knowledge remains advisory until independently verified and promoted through the existing learning and GREEN gates.

The browser never receives repository secrets and never writes the canonical repository memory directly.


## Unified internal cognition v2

The historical six-bot compatibility set is now a compatibility view over `FLIXO-BOT-BRAIN-v2`. Every internal repository agent and repair bot listed in `docs/agents/FLIXO-BOT.json#/distribution/systemWideInternalConsumers` receives the same complete cognitive substrate and the same canonical shared learning stream. Role overlays change default emphasis, workflow, ownership and authority only; they cannot reduce capability depth or create a private canonical learning store.

Canonical cognitive kernel: `docs/agents/FLIXO-BOT.json#/unifiedCognitiveKernel`.
Canonical memory: `diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json`.
Excluded from this internal memory authority domain: `execution-agent-clone-v1`, external runtime agents, and the retired historical CELL runtime pool.


## Single canonical memory

Protocol: `FLIXO-SINGLE-MEMORY-v1`.

There is one canonical learning store: `diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json`. All 200 cell members read this same store directly. A memory write is sufficient to make information available to the whole cell. There are no per-agent memory copies and visibility is not filtered by role. Provenance, Exact-SHA binding, and authority boundaries remain unchanged.
