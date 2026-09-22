# FLIXO Agent Coordination Control Plane v2

The repository uses one shared control plane for multi-agent execution, one durable per-session visibility ledger, and a President-controlled Wake Dispatcher integrated into the canonical communication relay. Runtime locks/state protect active ownership; the visibility ledger makes each agent's task and final outcome readable by the other agents.

## CELL-LAB — SHARED ENGINEERING LAB

The shared cell is the collaborative engineering laboratory. The coordination plane routes every material opinion, question, challenge and decision through Canonical Agent Communication and preserves the resulting agreement as a Cell-Lab packet.

Material lifecycle:
`OPEN → DISCUSS → QUESTION → CHALLENGE → RESOLVE → SYNTHESIZE → CONSENSUS → EXECUTE → VERIFY → LEARN`

Required core participants:
`MASTER-1 + MASTER-2 + MASTER-3 + mutation owner`.

A task may be claimed for preparation/analysis before consensus, but material source mutation is not execution-ready until the current Cell-Lab packet is `AGREED`, `executionReady=true`, `discussionClosed=true`, has no unresolved question/conflict, and its `exactSha` equals the current execution SHA.

Canonical packet:
`diagnostics/agents/cell-lab/consensus/<taskId>.json`

Machine enforcement:
`scripts/ci/cell-lab-consensus.mjs → scripts/ci/repair-protocol.mjs → mutation admission`

## State

`diagnostics/agents/coordination-state.json` is the canonical machine-readable queue state. It tracks tasks, dependencies, owners, sessions, authoritative SHA and task lifecycle.

`diagnostics/agents/coordination-locks.json` is the canonical scope/RCA lock ledger. An active lock conflicts when the RCA is identical or when mutable scope overlaps.

## Task packets

Each task has a packet at `diagnostics/agents/task-packets/<TASK_ID>.json` containing objective, known failure, RCA, scope, lane, dependencies and required evidence. Agents claim packets instead of inventing parallel work.

## Scheduling

Tasks may be `READY`, `QUEUED`, `RUNNING`, `DONE`, or `STALE` when their baseline or ownership evidence is no longer current. `STALE` tasks must be revalidated before execution. Dependencies must be `DONE` before a task can be claimed. Higher priority should be scheduled first by the coordinating agent. Independent scopes may run concurrently; overlapping scopes are rejected.

## Session continuity

A new agent session consumes the predecessor handoff before executing inherited work. Handoff reports are continuity input, never proof of completion. A new session must refresh the exact `main` SHA and must not continue from stale state.

## Safe completion

A task cannot become `DONE` while `remainingWork` or `openRcas` exist. A session cannot logout as `VERIFIED` while failed work, remaining work or open RCAs exist. In addition, `scripts/ci/agent-exit-lock.mjs` MUST prove canonical GREEN on the exact current SHA before closure. A failed exit attempt remains `OPEN/RUNNING`, records `EXIT_LOCK_BLOCKED`, and returns the work to recovery.

## Evidence

Task completion records exact exit SHA, evidence and findings. Primary certification remains owned by the canonical certification authority. Coordination state never substitutes for product evidence.

## Administrative Messages — attendance, comprehension and acceptance

**رسائل الإدارة** is the canonical human-facing name for the existing **Agent Communication** subsystem. It means the internal communication system shared by the Council, Masters, supervisors, and agents; it does not introduce another subsystem.

Administrative messages use the existing Master Inbox, relay, communication runtime, session, and coordination controls. Council administrative messages are P0 and require immediate handling before lower-priority scheduling.

تُعامل رسالة الإدارة كحالة حضور قابلة للإثبات: `PENDING_ACK → PARTIALLY_ACKNOWLEDGED → FULLY_ACKNOWLEDGED`; وبعد انقضاء `attendanceDeadlineAt` تُحوّل الحالات غير الحاضرة إلى `INQUIRY_REQUIRED` وتُرسل رسالة `ADMIN_ATTENDANCE_INQUIRY` إلى كل مستلم متخلف. لا توجد موافقة ضمنية بالصمت.

## Council meeting session lock

اجتماع المجلس المقفول بـ`meetingId` لا يُغلق من العضو؛ يلزم `assistantController` لإصدار موافقة خروج مرتبطة بـ`sessionId + meetingId + exactSha`.

## Communication ingress and delivery

Agent communication is part of this same control plane; it is not a second registry or protocol.

`Master Inbox (Issue #761) → agent-communication-relay.yml → agent-communication.mjs → agent-session.mjs → agent-coordination.mjs`.

The inbox lifecycle is `RECEIVED → READ → CONSUMED`. `STALE` and `BLOCKED_CONFLICT` are fail-closed states.

Every actionable message carries `messageId`, `idempotencyKey`, `recipient`, `taskId`, `scope`, `entrySha`, `risk`, dependencies and proof obligations. A duplicate delivery is a NO-OP. Reuse of a message identity with different content is an idempotency collision.

The event-driven relay is the primary delivery mechanism. Polling/supervision is recovery only. An agent session carrying an inbound `messageId` must read that message before task claim; task claim then revalidates message SHA, recipient, task and scope before acquiring the ownership lock.

Receipt or READ state never grants execution authority.
## Fast read path

`state` and `visible` are read-only commands. They never acquire the coordination write lock or advance the coordination revision, and they fail closed when the current repository SHA does not match the authoritative state.

`brief` is the preferred low-cost coordination snapshot. It returns only the exact SHA, revision/transaction identity, task counts, highest-priority ready/queued/running tasks, active agents and active locks. It is safe for concurrent status reads and is intended to replace repeated full-state scans during normal agent operation.

## CLI

`node scripts/ci/agent-coordination.mjs brief`


`node scripts/ci/agent-coordination.mjs task-create ...`

`node scripts/ci/agent-coordination.mjs task-claim ...`

`node scripts/ci/agent-coordination.mjs task-release ...`

`node scripts/ci/agent-coordination.mjs task-complete ...`

`node scripts/ci/agent-coordination.mjs ingest-handoff ...`

`node scripts/ci/agent-coordination.mjs state`

## Durable cross-agent visibility

Runtime files under `diagnostics/agents/` remain generated coordination state and may be absent from Git. The tracked cross-agent reading surface is:

`docs/agents/ledger/<sessionId>.json`

Every agent MUST login with `--task=<task-id>`. Login creates an OPEN/RUNNING record. Logout MUST write the final status and final summary. `task-complete` accepts only a VERIFIED closed record with a matching handoff and exact exit SHA; `task-release` accepts only a VERIFIED or BLOCKED closed record.

To inspect all visible agent records:
`node scripts/ci/agent-coordination.mjs visible`

Visibility never transfers authority and never replaces CI/certification evidence.

## Atomic coordination invariant

Mutating coordination commands are serialized by an OS-level write lock created atomically with `mkdir` at `diagnostics/agents/.coordination-write.lock/owner.json`. A bounded stale-lock policy prevents permanent deadlock after a crashed writer.

Queue state and lock state carry a shared monotonic `revision` and `transactionId`. A writer re-reads both files under the write lock before commit and fails closed on any revision or transaction mismatch. Persistence uses temporary files followed by atomic rename; readers reject mismatched state versions rather than accepting a partial transaction.

The canonical regression `scripts/ci/test-agent-coordination.mjs` starts concurrent `task-claim` processes against the same task and requires exactly one winner. This is the executable proof for the coordination race invariant.

## Admission parity, stale-session kill switch and topology

`ingest-handoff` must enforce the same admission boundary as session entry: the repository must be on `execution`, the predecessor must be closed, its `exitSha` must equal the current exact SHA, the continuation task must match, requested scope may not expand beyond the predecessor scope, and the successor role must pass the canonical repair admission check.

Every active coordination session stores its entry SHA, protocol hash and governance fingerprint. Before any mutating coordination command, the control plane reconciles active sessions. A changed entry SHA or governance fingerprint moves the session to `STALE`, marks its owned task `STALE`, releases its lock, removes it from `activeSessions`, and preserves a stale-session record. A stale session cannot regain ownership.

Mutating coordination commands are topology-bound to `execution`. `main` is read-only for this control plane. Governance drift and branch drift fail closed; they are never silently repaired by the coordination layer.


## Presidential control and Work Package admission

Council titles map to existing machine roles: PRESIDENT=`assistantController`, DEPUTY=`verification`, INVESTIGATOR=`analysis`. No second role registry is created.

Claimable work must be a large Work Package with `missionId + workPackageId + ownerRole + workItems + acceptanceCriteria + proofObligations`. Ledger materialization may create QUEUED work without an owner, but claim is blocked until Presidential assignment.

`task-next` returns an unassigned ledger task to `assistantController` as `PENDING_ASSIGNMENT`; it never silently assigns work to the previous worker.

President Wake is exact-SHA bound and dispatched by the canonical communication relay. Reusable routes: SCOUT→`code-read-only-scout.yml`, INVESTIGATOR→`ultra-investigator.yml`, PERFORMANCE→`root-cause-diagnostics.yml`, TEST→`test-matrix-contract.yml`, SECURITY→`repository-security-baseline.yml`. Roles without reusable workflows are `EXTERNAL_AGENT_WAKE_REQUIRED` and must never be represented as executed.


## External GPT account bridge

P20 also coordinates external runtime accounts through the canonical transport `/api/council/external-runtime`.

The Account Registry is `src/lib/council-account-registry.ts` and the durable state is persisted in Supabase tables `flix_council_accounts`, `flix_council_dispatches`, and `flix_council_events`.

Account boundaries:
- `CHIEF`: orchestration only; may dispatch Worker A/B.
- `WORKER_A`: bounded worker; may receive, ACK, heartbeat and complete.
- `WORKER_B`: bounded worker; may receive, ACK, heartbeat and complete.

A Worker's lease is bound to the exact repository SHA in its Dispatch. Expiry transfers the package to the configured counterpart once. The second expiry stays unresolved for Chief review.

The external bridge does not grant GitHub mutation, merge, deployment or certification authority. It is a transport and durable handoff layer only.
