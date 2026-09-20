# ✅ CANONICAL AGENT COUNCIL — PR #759

Issue #761 is archived and MUST NOT be used as an activation source. Active Council ingress is PR #759 on `execution → main`.

PRESIDENT=`assistantController`; DEPUTY=`verification`; INVESTIGATOR=`analysis`. These are coordination titles over existing machine roles and do not create mutation or certification authority.

Canonical Wake Dispatcher: integrated into `.github/workflows/agent-communication-relay.yml`, with `scripts/ci/council-wake-dispatch.mjs` as the deterministic planner.

# 🚨 AGENT ENTRY GATE — FLIXO-AI-TOOLS

**FIRST READ: `PROJECTS.md` → `المهام.md`**

**MANDATORY ENTRY TITLE:** `PROJECTS.md` → `المهام.md` → `AGENTS.md` → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK SCOPE → EXECUTION-ONLY CHANGE → TARGETED REGRESSION → EXACT-SHA PROOF → UPDATE MAPS → HANDOFF.

`PROJECTS.md` is the persistent project map. `المهام.md` is the mandatory open-task gateway and execution-scope contract. Both MUST be read before protocol files so an agent enters through the current authorized work scope rather than inventing a new task.

## READ-BEFORE-ACTION

Before any repository action, every agent MUST read, in this order:

1. `PROJECTS.md`
2. `المهام.md`
3. `AGENTS.md`
4. `docs/EXECUTION-BRANCH-PROTOCOL.md`
5. `docs/AGENT-COLLABORATION-PROTOCOL.md`
6. `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
7. `docs/AGENT-COORDINATION-CONTROL-PLANE.md`
8. `docs/PROTOCOL-HIERARCHY.md`
9. `docs/PROTOCOL-REGISTRY.json`
10. `docs/agents/PROMPT-REGISTRY.json`
11. `diagnostics/auto-repair/memory.json`
12. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
13. `scripts/ci/test-plan.json`
14. `scripts/ci/assertion-registry.json`
15. the current exact `main` SHA and current workflow state

`PROJECTS.md` is the navigation/control layer; `المهام.md` is the open-task scope gate; the linked contract/plan remains authoritative for implementation semantics, and CI/evidence remains authoritative for completion.

## TASK GATE

`المهام.md` is mandatory for every agent session.

The agent MUST NOT:
- begin implementation before reading it;
- invent a new task that is not authorized by the task gate;
- treat `CANDIDATE` as executable;
- treat `LOCKED` as executable before dependencies are complete;
- delete an open task before the deletion protocol is satisfied;
- reuse a closed task as current proof without a new RCA and current evidence.

The active queue in `المهام.md` is the only default execution scope. Any addition, status transition, or retirement of a material task MUST be reflected in `المهام.md` and `PROJECTS.md`.

## TWO-BRANCH EXECUTION POLICY

The repository has exactly two active branch paths:

```text
execution → main
```

- `execution` is the sole base/working/repair/integration branch.
- `main` is the sole primary/production/source-of-truth branch.
- No feature, fix, chore, repair, bot, agent, test, diagnostic, temporary, experimental, preview, backup, per-run, per-error, or per-task branch may be created or used as an active work path.
- Historical branches may remain as archived Git history, but they are not valid execution paths.

Routine work, repairs, diagnostics, agent execution, testing fixes, and integration preparation all occur on `execution`. Promotion occurs only through `execution → main` after required verification.

### NORMAL ROUTE

```text
main → synchronize execution → change/repair on execution → targeted regression → required verification → exact-SHA proof → execution → main
```

There is exactly one integration PR at a time: `execution → main`.

## BRANCH SAFETY

The agent MUST:
- verify `git branch --show-current == execution` before mutation;
- keep `main` immutable during work and repair;
- fail closed if `execution` is not safely synchronized with the current `main` baseline;
- never create a third branch to resolve a conflict, new RED, task, or repair attempt;
- never force-push or rewrite `main`.

Any workflow, script, task packet, or agent that attempts to create, push, or merge a third branch is non-compliant and must fail closed.

## TESTING ECONOMY

Routine changes use targeted regression first. Full canonical CI is required whenever the governing contract, affected graph, release boundary, or task closure requires it.

Branch-local, stale, partial, inferred, or provider-bypassed evidence MUST NOT be used as final `main` certification.

After every execution change:

`resolve exact execution SHA → inspect required checks → run required verification → record SHA/evidence`

## MAIN SAFETY

`main` MUST remain the stable truth layer and is never an agent working branch.

A change that fails targeted regression MUST NOT be followed by unrelated changes. Perform RCA, repair the causal source on `execution`, rerun the regression, and continue from the new exact SHA.

## EXTERNAL PROVIDER NON-BLOCKING RULE

An external deployment-provider failure such as a Vercel quota, rate-limit, outage, unavailable deployment, or provider API error MUST NOT stop independent repository execution.

The provider failure remains a blocker only for assertions or closure claims that explicitly require live provider/deployment evidence. Agents MUST preserve the failure as an external infrastructure condition and MUST NOT relabel it as application failure, application GREEN, or successful deployment evidence.

## PROJECT MAP DISCIPLINE

`PROJECTS.md` MUST preserve, for every material task:
- stable task ID;
- title and purpose;
- status;
- exact base/head SHA when implementation begins or ends;
- linked contract/plan;
- owner/agent scope;
- evidence reference when available;
- first blocker when blocked;
- next deterministic action;
- remaining child work.

Status meanings are strict: `ACTIVE`, `CANDIDATE`, `NEEDS DEVELOPMENT`, `DEFER`, `CANCELLED`, `BLOCKED`, `IMPLEMENTED / VERIFICATION PENDING`, `CLOSED / STABLE`.

`CANDIDATE ≠ ACTIVE`. `DEFER ≠ forgotten`.

Every session MUST update `PROJECTS.md` before leaving material unfinished work. Chat memory is not a project ledger.

## TASK AGENT AUTHORITY

`Task Agent = preparation only` is a machine-enforced authority boundary.

The Task Agent may understand tasks, inspect evidence, consume Prompt Registry/Memory, prepare bounded changes and emit a handoff packet.

The Task Agent MUST NOT mutate source, commit, push, create or merge pull requests, certify, or declare GREEN/CLOSED/VERIFIED.

Repository mutation is limited to the canonical mutation roles admitted by `scripts/ci/repair-protocol.mjs`: `repairAgent` and `executionAgent`. `assistantRepairAgent` is fallback-only: it may mutate only when both primary mutation agents are unavailable, a learned rule has support >= 2 and confidence >= 0.90, the exact target SHA matches, and repair admission passes.

A prompt, memory record, scout report, or handoff cannot grant mutation authority.

## COMMUNICATION-FIRST GATE

The shared agent communication channel is the first operational dependency for every agent.

`NOTIFICATION → MASTER INBOX → EVENT-DRIVEN RELAY → READ → EXACT-SHA REVALIDATION → LOCK_SCOPE → TASK CLAIM → EXECUTE`

The canonical communication runtime is `scripts/ci/agent-communication.mjs`, the event ingress is `.github/workflows/agent-communication-relay.yml`, the active Council ingress is PR #759, and Wake Dispatch is `.github/workflows/council-wake-dispatch.yml`. Issue #761 is archived and rejected.

Every actionable message MUST carry a unique `messageId`/`idempotencyKey`, target `recipient`, `taskId`, declared `scope`, exact `entrySha`, risk, dependencies, expected evidence, stop conditions and proof obligations.

Message receipt is not execution authority. `RECEIVED` means the message has entered the canonical inbox. `READ` means the target agent has explicitly consumed it. `CONSUMED` is allowed only after current exact-SHA validation and execution admission. `STALE` and `BLOCKED_CONFLICT` are fail-closed states.

An agent session created from an inbound message MUST preserve `messageId` and message SHA in its session and visibility record. The following task claim MUST bind to that message and recheck message recipient, task, scope and exact SHA.

Periodic polling is recovery only. Event-driven delivery is the primary notification path.
## AGENT LOGIN

Before changing repository state, the agent MUST create:

`diagnostics/agents/sessions/<session-id>.json`

with:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

No session record means unauthorized repository execution.

Canonical login:
`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --task=<task-id> --role=<role> --rca=<RCA-ID> --scope=<scope>`

`--task=<task-id>` is mandatory. Login also creates the durable cross-agent visibility record:
`docs/agents/ledger/<session-id>.json`

Other agents MUST read this tracked ledger before accepting overlapping work.

When a predecessor handoff exists, the canonical continuation login flag is exactly:
`--from-session=<previous-session>`

The first chain may use explicit `--bootstrap=true` only when no predecessor exists.

## COORDINATION CONTROL PLANE

Before implementation work, create or claim a task through the shared control plane:

`node scripts/ci/agent-coordination.mjs task-create ...`
`node scripts/ci/agent-coordination.mjs task-claim --task=<id> --session=<id> --agent=<id>`

The control plane rejects overlapping active RCA or mutable scope ownership. Mutating coordination is permitted only on `execution`; `main` remains read-only. Handoff ingestion requires the predecessor exact `exitSha` to equal the current `execution` SHA and cannot expand the predecessor scope. Active sessions whose entry SHA or governance fingerprint becomes stale are revoked fail-closed.

A claimed task is not complete until its exact exit SHA, evidence, findings, remaining work, and RCA state are recorded.

## ROOT-CAUSE-FIRST REPAIR PROTOCOL

Every repair MUST be treated as root-cause elimination, never symptom suppression.

Before code changes, the agent MUST assign a unique RCA-ID and record: `trigger → propagation path → violated invariant → responsible source → observable symptom`.

Invalid repairs include weakening assertions, suppressing errors, silent skips, broad allowlists, changing expected values to match broken behavior, retrying deterministic failures, deleting coverage, or moving the failure to another layer.

Every repair MUST add or strengthen a targeted regression that fails on the pre-repair behavior and passes because the causal defect is fixed.

RCA closure requires:
`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure`

A repair that creates a new failure remains on `execution` with its own RCA-ID and recovery continues from the new exact SHA. It never creates a new branch.

## SUPREME AUTOMATION RESIDENCY PROTOCOL

The Agent Liveness / Permanent Residency Protocol is the highest operational automation contract in this repository. It governs the repair and automation plane and overrides lower-level workflow, agent, task, session, timeout, budget, queue, retry, or convenience rules whenever they conflict with residency, heartbeat, recovery, or continuity.

Mandatory invariants:
- The automation/repair plane MUST remain resident while any RED, OPEN WORK, BLOCKED_EXTERNAL, ACTIVE REPAIR, or unverified execution state exists.
- A 5-minute heartbeat is mandatory. A missed/stale heartbeat is a recovery event, never permission to stop.
- SLEEP, IDLE, SILENT, ABANDONED, self-abort, and silent termination are forbidden while work is open.
- A workflow run ending, timing out, reaching a session budget, losing a lease, or being superseded MUST NOT close the task. It MUST recover and continue automatically.
- GREEN closes the current repair obligation only after exact-SHA evidence proves zero required RED; it MUST NOT disable permanent residency.
- No executor may dispatch itself. The canonical Green Gate remains the sole repair dispatcher.
- Liveness failure MUST fail closed into RECOVERING and re-enter the canonical wake/dispatch path; it MUST NOT strand repair as a terminal dispatch failure.
- Manual workflow dispatch is never a prerequisite for repair continuity.
- Every change to this contract requires targeted enforcement tests proving lower-level actors cannot suspend or bypass residency.

Enforcement order: SUPREME RESIDENCY -> ZERO-FALSE-GREEN -> ROOT-CAUSE REPAIR -> all other repository protocols.

## PROTOCOL HIERARCHY

The normative hierarchy and anti-bloat gate are defined in `docs/PROTOCOL-HIERARCHY.md`, while `docs/PROTOCOL-REGISTRY.json` is the canonical machine-readable inventory of approved protocols.

When protocol rules conflict, precedence is: Master execution and safety contract → Zero-False-Green/evidence integrity → Root-Cause-First Repair → G1/G2/G3/G4 and release contracts → Change-Scope Integrity/Dependency-Graph Closure → testing/certification/collaboration/coordination/recovery → CI optimization.

No new standalone protocol may be introduced unless a recurring failure class is proven, existing controls are insufficient, the invariant and authoritative enforcement boundary are named, a regression/enforcement test is defined, and duplication/conflict analysis passes. Extend an existing protocol when it can absorb the requirement without ambiguity.

## OWNERSHIP

Each active agent MUST declare its RCA and file/contract scope. One active owner per RCA and one active owner per mutable scope unless an explicit handoff transfers ownership.

If `main` moves, refresh the exact `main` SHA and synchronize `execution` before new work. Stale task packets or sessions must not be used as current repository state.

## EXECUTION LEDGER

Meaningful work follows:

`READ → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK → EXECUTION-ONLY CHANGE → TARGETED REGRESSION → REQUIRED CI/CERTIFICATION → EXACT-SHA PROOF → UPDATE PROJECT MAPS → execution → main → HANDOFF`

The session record MUST preserve actual commands, scope, SHA lineage, evidence, findings, and batch membership.

## ZERO-FALSE-GREEN

Agents MUST NOT weaken assertions, disable tests, add silent skips, relabel failures without evidence, reuse stale evidence, or declare GREEN from partial execution.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are recovery states.

### Mandatory cycle lesson list

Every completed repair/verification cycle MUST emit `cycleLessons` containing the RCA lesson, strategy lesson or anti-lesson, verification state, affected scope when applicable, recurrence/prevention rule, and external-blocker anti-lesson when applicable. `cycleLessons` is learning/continuity evidence only; it never authorizes mutation or certification.

## HANDOFF / LOGOUT

Every completed session MUST logout using:

`node scripts/ci/agent-session.mjs logout --session=<id> --agent=<id> --status=VERIFIED|BLOCKED --final-summary=<final-outcome>`

A final summary is mandatory. Logout automatically writes:
`diagnostics/agents/handoffs/<session-id>.json`

and the durable cross-agent ledger:
`docs/agents/ledger/<session-id>.json`

The report MUST preserve:
`completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent`

along with `exitSha`, changed files, commands, evidence, findings, RCA closure/open state, and current batch count.

The next agent MUST ingest the predecessor report before executing inherited work. The next agent also reads the durable visibility ledger before accepting overlapping work. Handoff reports and visibility records are continuity evidence, not certification evidence.

A task may be closed only after logout has recorded the final task status and `agent-coordination.mjs task-complete` verifies the closed visibility record plus the exact exit SHA.

## Repository test contract

The repository uses one automatic test workflow: `.github/workflows/ci.yml`.

- `verify` is the single non-browser engine. It installs dependencies once, executes the canonical static contracts, performs the canonical production build, and publishes one immutable artifact identified by exact commit SHA and package-lock digest.
- `browser_fast` is the only fast browser engine: 22 canonical tools × Chromium/Firefox/WebKit = 66 execution units.
- `browser_deep` is the same browser engine in deep mode: canonical public-route localization/runtime coverage across 20 locales and Chromium/WebKit/Firefox. It runs on main/release paths when the governing contract requires it.
- `certify` is the only automatic certification authority. It is fail-closed and consumes evidence from the same workflow run.

## Safety invariants

- Do not delete coverage to obtain Green. Consolidate duplicate execution only.
- Preserve G2, G3, G4, Exact SHA, immutable artifact identity, negative readiness, localization, accessibility, console/network, artifact integrity and determinism coverage.
- Fast Verify and Ultra may select/classify work, but must not create a second browser execution owner.
- One assertion has exactly one canonical execution owner.
- One automatic workflow must own routine certification. Retired/shadow workflows are not certification authorities.
- `https://canonical.test` is a restricted unit/contract sentinel and is forbidden from certification provenance.
- GREEN is valid only when every required engine passes, evidence is valid and complete, Exact SHA matches, and independent root causes are zero. Skips, masked failures, stale evidence and partial passes are not Green.
- Never claim a green release without fresh exact-SHA CI evidence.

**MANDATORY ENTRY: `PROJECTS.md` → `المهام.md` → `AGENTS.md` → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK SCOPE → EXECUTION-ONLY CHANGE → TARGETED REGRESSION → EXACT-SHA PROOF → UPDATE PROJECT MAPS → HANDOFF.**


## PRESIDENTIAL COUNCIL OPERATING MODEL

`PRESIDENT → DEPUTY → INVESTIGATOR → SPECIALIST → VERIFY → HANDOFF → PRESIDENT`

Tasks are large causally coherent Work Packages. Every claim requires ownerRole, Work Package identity, acceptance criteria, proof obligations and exact SHA. Unassigned ledger work returns to the President as PENDING_ASSIGNMENT. An agent stops after handoff and does not self-assign another package.
