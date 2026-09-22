## P00 — SUPREME CELL OBLIGATION

The cell cannot execute a task until P00 is admitted:
docs/agents/PROMPT-UNIFIED-EXECUTION.md — RPR-UNIFIED-EXECUTION-001 v4.0.0.

This applies to CELL-HQ, Masters 1/2/3, every resident bot and every external/runtime adapter participating in the cell. Every assignment inherits P00; no task packet or Master instruction may override it. Open work loops back to recovery, and exit remains hard-locked until canonical GREEN on the same exact SHA.

Required cell entry:
ADMIT P00 → REGISTER SESSION → CAPTURE SHA → READ STATE → DECLARE SCOPE → COORDINATE → EXECUTE → VERIFY → REPORT → CONTINUE.

# FLIXO — Cell Control Headquarters

**Headquarters:** `CELL-HQ`  
**Control seat:** `CELL-CONTROL-SEAT`  
**Chair:** `assistantController`  
**Runtime identity:** existing `CHIEF` only

The headquarters is a logical coordination surface inside the existing Control Plane. It does not create a fourth runtime identity or independent authority.

## Operating loop

`MASTER PLAN → CELL-HQ → one bot / one task / one scope → execution → evidence + knowledge → reassess`

Every assignment is bound to `planId + planVersion + planHash + entrySha + taskId + scope`.

A bot must stop and request presence when the plan is stale, the SHA changes, scope conflicts, evidence is contradictory/insufficient, or an authority decision is required.

## Exit lock enforcement

Session closure is permitted only after the machine exit gate proves canonical GREEN on the current exact SHA. Any rejected closure is recorded as `EXIT_LOCK_BLOCKED`; the visibility record remains `OPEN/RUNNING` and the cell continues recovery/coordination.

## Communication room

Channels: `CONTROL`, `PRESENCE`, `RCA`, `TASK`, `VERIFY`, `KNOWLEDGE`.

Responsible participants:
`assistantController · taskAgent · errorAgent · repairAgent · codeScout · reviewAgent · testAgent · securityAgent · performanceAgent · certificationAuthority`

### Presence

Bots use the canonical Master Inbox and send `PRESENCE_REQUEST` to `assistantController`. Minimum data: request ID, message ID, bot, task, priority, reason, exact SHA, evidence, requested action, blocking flag.

Lifecycle remains `RECEIVED → READ → CONSUMED`. Presence never grants authority.

Example:
```bash
node scripts/ci/agent-communication.mjs presence --bot=CELL-017 --task=CELL-TASK-001 --priority=P1 --reason="Conflicting evidence" --requested-action="REVALIDATE_AND_WAKE_CONTROLLER" --evidence=evidence://run/123
```

## Attendance

`scripts/ci/cell-attendance.mjs` records check-in/check-out for every task and binds attendance to the internal plan and exact SHA.

The attendance record captures task identity, purpose, scope, result, evidence, knowledge return, duration, and objective upgrade signals.

`node scripts/ci/cell-attendance.mjs assess` produces the current upgrade assessment.

The assessment is advisory evidence for Controller reassessment; it never grants permissions automatically.
