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
→ OWNER_MUTATION

Every contributor must publish a contribution bound to taskId + failureFingerprint + exact target SHA + runId. Every participant must receive the other two contributions before mutation authorization.

The chat may carry provisional learning during RED. Shared knowledge is promotable only after Canonical GREEN.

SLEEP/IDLE is not a chat state for an open mission. A completed mission requires a GREEN record before sleep admission.

## Vault change watchdog

Any committed change under ACTION VAULT wakes ACTION-REPAIR, ACTION-REPAIR-2, and ACTION-HISTORIAN-3 on the exact resulting SHA. The wake creates a shared preparation task and runs only the targeted vault regression set; it does not authorize source mutation.
