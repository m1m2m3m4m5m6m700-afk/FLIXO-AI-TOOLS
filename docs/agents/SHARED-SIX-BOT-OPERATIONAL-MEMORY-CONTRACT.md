# FLIXO — SHARED SIX-BOT OPERATIONAL MEMORY

Protocol: `FLIXO-SHARED-OPERATIONAL-MEMORY-v1`

Canonical store:

`diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json`

## Participants

`ACTION-REPAIR` ↔ `ACTION-REPAIR-2`

`READ-INVESTIGATOR` ↔ `READ-ADVERSARY`

`executionAgent` ↔ `reviewAgent`

Every published record is visible to all six participants.

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

New learning is published once and becomes available to all six bots.

Repair failures and counterexamples are retained so execution can avoid repeating them.

Read-side findings are fed back so repair and execution can avoid incorrect analysis and selection.

Execution/review findings are fed back so reading and repair can avoid recurrence.

Legacy Action/Cell memories remain context-only read-through sources during migration and do not become a second authority for new learning.

No third branch is created for memory synchronization.
