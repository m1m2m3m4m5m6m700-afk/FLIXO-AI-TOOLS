# FLIXO — Cell Control Headquarters

**Headquarters:** `CELL-HQ`  
**Control seat:** `CELL-CONTROL-SEAT`  
**Chair:** `assistantController`  
**Runtime identity:** existing `CHIEF` only

The headquarters is a logical coordination surface inside the existing Control Plane. It does not create a fourth runtime identity or independent authority.

## Supreme cell operating contract

All agents operate as members of one shared cell. Each agent may determine and declare its bounded operational scope from the active task and current evidence, while explicitly recognizing peer-agent scopes and dependencies. Cross-scope work requires canonical communication and an explicit handoff/request.

Cell target: `0 ERRORS`. No agent, Master, workflow, lease, timeout, session completion, or handoff is terminal while relevant RED, OPEN WORK, unresolved RCA, required unrun checks, or unverified results remain.

Masters 1/2/3 maintain one shared execution view and expose their workflow, plan, executed work, in-progress work, remaining work, collaborators, dependencies, blockers, next action, current SHA, and verification status. They cooperate openly and prevent duplicated or conflicting execution.

## Operating loop

`MASTER PLAN → CELL-HQ → one bot / one task / one scope → execution → evidence + knowledge → reassess`

Every assignment is bound to `planId + planVersion + planHash + entrySha + taskId + scope`.

A bot must stop and request presence when the plan is stale, the SHA changes, scope conflicts, evidence is contradictory/insufficient, or an authority decision is required.

## Supervisors Council execution visibility

After each material repair/verification cycle, the active agent/Master publishes a `SUPERVISORS_UPDATE` through the existing canonical communication path with `AGENT, SESSION_ID, TASK, START_SHA, CURRENT_SHA, EXECUTED, FILES_CHANGED, AGENTS_CONTACTED, CHECKS_EXECUTED, PASSED, FAILED, NOT_RUN, ERRORS_BEFORE, ERRORS_RESOLVED, ERRORS_REMAINING, RCA_REMAINING, SECURITY_STATUS, CI_STATUS, REMAINING_WORK, BLOCKERS, NEXT_ACTION, STATUS`. This is operational visibility; certification remains bound to canonical evidence.

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
