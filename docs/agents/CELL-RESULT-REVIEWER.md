# FLIXO — Cell Result Reviewer

**Reviewer:** `CELL-RESULT-REVIEWER`  
**Role:** `INDEPENDENT_RESULT_REVIEWER`

The reviewer is a logical Control Plane role, not a fourth external runtime identity and not a mutation/certification authority.

## Review flow

`BOT CHECK-OUT → RESULT REVIEW → ACCEPT / REVISE / REJECT / ESCALATE → KNOWLEDGE ADMISSION → POOL RETURN`

The reviewer receives:
- bot identity
- task and plan identity
- entry/exit SHA
- result
- evidence
- returned knowledge

It evaluates:
- task completion
- evidence quality
- plan alignment
- correctness
- knowledge quality

Every review returns a 0–100 score, findings, evidence references, upgrade signals and exactly one next action.

## Rules

A reviewer never invents missing evidence. Missing/contradictory evidence causes `REVISE` or `ESCALATE`.

A reviewer does not rewrite the bot's result and does not grant permissions.

The reviewer is deliberately separate from the executing bot so that a task cannot self-certify its own result.

The Controller uses the review history together with attendance history to identify recurring weaknesses and determine whether a bot needs coaching, specialization, upgrade or recycling.
