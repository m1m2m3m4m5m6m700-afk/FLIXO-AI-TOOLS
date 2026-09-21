# ACTION VAULT CHAT PROTOCOL

The Action Vault chat is the internal work channel for Action-repair agents.

Participants:
ACTION-MASTER
ACTION-REPAIR
ACTION-REPAIR-2
ACTION-HISTORIAN-3
ACTION-TWIN-1
ACTION-TWIN-2
ACTION-INDEX
ACTION-WISE

Every message is bound to taskId + failureFingerprint + exact target SHA. A message is not evidence of correctness by itself.

Allowed conversation kinds:
TASK_ASSIGNMENT
OBSERVATION
QUESTION
CHALLENGE
SOLUTION_PROPOSAL
HANDOFF
RESULT
LESSON
BLOCKED_EXTERNAL

Workflow:
1. Master or the active repair owner opens the task chat.
2. Tasks and explorations are assigned through the chat.
3. Bots exchange findings, challenges, and proposed solutions.
4. All bots may learn from unverified messages for the current mission.
5. A lesson becomes shared verified knowledge only after Canonical CI GREEN.
6. The historian records the final RED→changes→GREEN chain.
7. Chat never grants mutation authority and never replaces Canonical CI.

Isolation:
The chat belongs to ACTION VAULT and is independent of CELL. It does not write test-system logs or alter their records.

Persistence:
Current-session chat is stored in the Action Vault transcript and indexed by task/fingerprint/SHA. Verified knowledge is promoted into each participating bot's memory after GREEN.


## Parallel-learning extension

The three resident agents work in parallel cognitive lanes:

- ACTION-REPAIR → PRIMARY_EXECUTION_RCA_AND_BOUNDED_REPAIR
- ACTION-REPAIR-2 → INDEPENDENT_RCA_CHALLENGE_AND_FALSIFICATION
- ACTION-HISTORIAN-3 → EVIDENCE_INTAKE_INDEX_PROVENANCE_AND_LEARNING

Before source mutation, the chat session MUST reach:

PARALLEL_DISCOVERY
→ PARALLEL_ANALYSIS
→ CROSS_LEARNING
→ CHALLENGE
→ SYNTHESIS
→ PATCH_SYNTHESIS
→ SANDBOX_SIMULATION
→ DIFFERENTIAL_VERIFICATION
→ OWNER_MUTATION

Every contributor must publish a contribution bound to taskId + failureFingerprint + exact target SHA + runId. Every participant must receive the other two contributions before mutation authorization.

The chat may carry provisional learning during RED. Shared knowledge is promotable only after Canonical GREEN.

SLEEP/IDLE is not a chat state for an open mission. A completed mission requires a GREEN record before sleep admission.

## Vault change watchdog

Any committed change under ACTION VAULT wakes ACTION-REPAIR, ACTION-REPAIR-2, and ACTION-HISTORIAN-3 on the exact resulting SHA. The wake creates a shared preparation task and runs only the targeted vault regression set; it does not authorize source mutation.

## Specialized triad roles


### ACTION-REPAIR — Constructive programmer seat
Reads the current code as a programmer, performs root-cause reasoning, consumes the historical and knowledge evidence, and may apply the bounded source repair only when selected as the single active owner after the full triad gate.

### ACTION-REPAIR-2 — Adversarial programmer seat
Shares the programming reasoning stack, searches the historical Action error index, repair catalog, memory, lessons and anti-lessons, attempts to falsify the primary diagnosis/repair, and may add or edit repair knowledge. It may apply a bounded source repair only when selected as the single active owner after the full triad gate. It never mutates tests or main.

### ACTION-HISTORIAN-3 — Master knowledge and diagnosis seat
Owns the Action Vault index, may add and edit index knowledge, records every RED, repair attempt, repaired outcome, unresolved failure, handoff and Canonical GREEN chain with exact task/fingerprint/SHA/run provenance, and decides whether the programming diagnosis matches the textual knowledge. It may also apply the bounded source repair when selected as the single active owner.

### Required order
FAILURE RECORD
→ HISTORICAL SEARCH + PREDICTION
→ PROGRAMMER ANALYSIS
→ PATCH SYNTHESIS
→ SANDBOX SIMULATION
→ DIFFERENTIAL VERIFICATION
→ OWNER MUTATION
→ VERIFICATION
→ FAILURE/GREEN RECORD

A prediction is a proposal, not proof. The programmer may reject it. A repair attempt may fail. Every failure is recorded and remains part of the learning corpus. Only Canonical GREEN promotes lessons to verified knowledge.


## Repair engineering guard

All three Action Vault bots may be selected as the single programming mutation owner. Only one source-mutation owner may be active for a task. Patch synthesis creates bounded candidates; sandbox simulation executes only in a detached exact-SHA worktree; differential verification checks scope and gate integrity. Simulation never mutates the source worktree and never grants GREEN.

ACTION-HISTORIAN-3 is the mandatory diagnosis-to-knowledge judge before source mutation and the custodian of ACTION-INDEX-4000. ACTION-REPAIR-2 remains adversarial even when selected as owner. Canonical GREEN remains mandatory before closure or learning promotion.

## Mandatory supervisory-learning protocol

Before any Action Vault bot performs analysis, repair, knowledge write, knowledge edit, escalation, handoff, or closure, it MUST read:

`diagnostics/auto-repair/action-vault/ACTION-VAULT-SUPERVISORY-LEARNING-PROTOCOL.md`

The protocol is enforced by the Action Vault agent gate and by the triad runtime. A bot must not claim participation until the read check succeeds on the current exact SHA.

ACTION-HISTORIAN-3 owns the write/edit authority for the Action Vault index:

`diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`

It records every verified repair outcome and every unresolved repair failure. Every unresolved failure is escalated to `assistantController` through the canonical agent-communication path and the active Council ingress so a specialist supervisor can teach the missing knowledge. Returned supervisor advice is written back into the same Action Vault index with full provenance. Canonical GREEN remains the promotion authority for verified learning.


## Final mandatory rule — learning is never lost

Every unresolved repair failure is recorded by ACTION-HISTORIAN-3 and escalated through the canonical Council path for specialist teaching. The returned lesson is not kept only in chat: it is written into `ACTION-INDEX-4000.json` with exact provenance. A repaired outcome is also recorded in that same index. No failure may disappear merely because the repair process moved to another attempt.
