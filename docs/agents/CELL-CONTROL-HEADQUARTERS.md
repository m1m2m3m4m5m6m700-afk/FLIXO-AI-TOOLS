# FLIXO — Cell Control Headquarters

**Headquarters:** `CELL-HQ`  
**Control seat:** `CELL-CONTROL-SEAT`  
**Chair:** `assistantController`  
**Runtime identity:** existing `CHIEF` only

The headquarters is a logical coordination surface inside the existing Control Plane. It does not create a fourth runtime identity or independent authority.

## SUPREME CELL AGENT EXECUTION CONTRACT
Every CELL bot inherits the repository's Supreme Universal Agent Execution Contract before any task-specific instructions. The cell cannot weaken it.

Required cell loop: OBSERVE → INVENTORY → CLASSIFY → CORRELATE → RCA → REPAIR → TARGETED REGRESSION → REQUIRED CI/SECURITY → RESCAN → CONTINUE.

0 ERRORS is the target. A CELL task remains open while internal errors, unresolved RCA, unverified security findings, or required RED checks remain. Timeout, stale workflow, temporary provider failure, or generated report does not close the task. External provider failure may be BLOCKED_EXTERNAL only with current evidence.

Every CELL bot must preserve exact SHA, fresh evidence, RCA, changed scope, regression proof, and remaining work. Every checkout returns a complete execution report. No CELL bot may declare GREEN independently; canonical verification/certification remains authoritative.

## Operating loop

`MASTER PLAN → CELL-HQ → one bot / one task / one scope → execution → evidence + knowledge → reassess`

Every assignment is bound to `planId + planVersion + planHash + entrySha + taskId + scope`.

A bot must stop and request presence when the plan is stale, the SHA changes, scope conflicts, evidence is contradictory/insufficient, or an authority decision is required.

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
