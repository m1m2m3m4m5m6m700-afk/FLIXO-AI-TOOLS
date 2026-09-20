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
