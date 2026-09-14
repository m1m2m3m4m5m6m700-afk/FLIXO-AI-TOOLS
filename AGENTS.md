# 🚨 AGENT ENTRY GATE — FLIXO-AI-TOOLS

**FIRST READ: `PROJECTS.md` → `المهام.md`**

**MANDATORY ENTRY TITLE:** `PROJECTS.md` → `المهام.md` → `AGENTS.md` → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK SCOPE → EXECUTE ON `execution` → TARGETED REGRESSION → BATCH VERIFICATION → EXACT-SHA PROOF → MERGE `execution` → `main` → HANDOFF.

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
10. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
11. `scripts/ci/test-plan.json`
12. `scripts/ci/assertion-registry.json`
13. the current exact `main` SHA, current exact `execution` SHA, and current workflow state

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

## EXECUTION-BRANCH POLICY

The repository has exactly two normal branches in the active execution model:

- `main` = stable source of truth, release/production baseline, and final certification target.
- `execution` = sole routine integration and implementation branch.

All normal implementation, repair, refactoring, cleanup, documentation, tool expansion, testing, and CI-repair work MUST be executed on `execution`.

Routine feature, repair, diagnostic, agent, workaround, temporary, per-tool, or per-task branches MUST NOT be created. Stacked routine PRs and branch chains are prohibited.

A temporary branch is allowed only when an external system or exceptional recovery requires it. Such a branch is not an execution path and its validated result MUST return to `execution` before normal work continues.

### SINGLE EXECUTION PATH

Normal work follows:

`main → execution → change → targeted regression → next change → ... → batch boundary → canonical CI/certification → Exact-SHA proof → execution → main → main verification → execution synchronization`

All mutable routine work MUST have exactly one active owner and one active branch: `execution`.

### BATCH-20 RULE

The default integration boundary is **20 successful changes**.

A change counts only when:

`change present on execution ∧ targeted regression PASS`

At 20 successful changes, the batch MUST enter canonical CI/certification and, when all required gates pass, merge to `main`.

An earlier merge boundary is mandatory for:
- end of the working day;
- security/authentication/authorization boundary;
- persistence or production-sensitive boundary;
- major contract or architectural boundary;
- rollback scope becoming materially large;
- any requirement that final evidence be frozen on `main`.

Twenty is a maximum batch size, not a requirement to accumulate unnecessary changes.

### TESTING ECONOMY

Routine changes use targeted regression first. Full canonical CI is NOT required for every individual routine change.

Canonical CI/certification is the batch gate for `execution → main`. High-risk changes may trigger earlier canonical verification; safety and evidence requirements always override batching.

Branch-local evidence MUST NOT be used as final `main` certification evidence. Final proof requires the resulting exact `main` SHA.

### MAIN SAFETY

`main` MUST remain the stable truth layer. Direct routine implementation on `main` is prohibited.

`main` may change only through the approved integration boundary from `execution`, except explicit repository-provider/recovery operations that are independently governed.

After every `main` movement, agents MUST re-resolve the exact `main` SHA and synchronize `execution` before adding further routine work.

Historical branch state, stale PR state, old SHA, old CI, and stale deployment evidence MUST NOT be treated as current state.

PRs are integration boundaries, not routine development paths. The normal integration PR is `execution → main`; task-specific PR chains are prohibited unless an explicit exception is recorded.

### EXTERNAL PROVIDER NON-BLOCKING RULE

An external deployment-provider failure such as a Vercel quota, rate-limit, outage, unavailable deployment, or provider API error MUST NOT stop independent repository execution. Agents MUST continue any code, test, documentation, analysis, cleanup, and verification work whose prerequisites are satisfied.

The provider failure remains a blocker only for assertions or closure claims that explicitly require live provider/deployment evidence. Agents MUST preserve the failure as an external infrastructure condition and MUST NOT relabel it as application failure, application GREEN, or successful deployment evidence.

## PROJECT MAP DISCIPLINE

`PROJECTS.md` MUST preserve, for every material task:

- stable task ID
- title and purpose
- status
- exact base/head SHA when implementation begins or ends
- linked contract/plan
- owner/agent scope
- evidence reference when available
- first blocker when blocked
- next deterministic action
- remaining child work

Status meanings are strict: `ACTIVE`, `CANDIDATE`, `NEEDS DEVELOPMENT`, `DEFER`, `CANCELLED`, `BLOCKED`, `IMPLEMENTED / VERIFICATION PENDING`, `CLOSED / STABLE`.

`CANDIDATE ≠ ACTIVE`. `DEFER ≠ forgotten`.

Every session MUST update `PROJECTS.md` before leaving material unfinished work. Chat memory is not a project ledger.

## AGENT LOGIN

Before changing repository state, the agent MUST create:

`diagnostics/agents/sessions/<session-id>.json`

with:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

No session record means unauthorized repository execution.

Canonical login:

`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --rca=<RCA-ID> --scope=<scope>`

When a predecessor handoff exists, the agent MUST continue it. The canonical continuation login flag is exactly:

`--from-session=<previous-session>`

Canonical continuation login:

`node scripts/ci/agent-session.mjs login --session=<new-id> --agent=<id> --role=<role> --from-session=<previous-session> ...`

The first chain may use explicit `--bootstrap=true` only when no predecessor exists.

## COORDINATION CONTROL PLANE

Before implementation work, create or claim a task through the shared control plane:

`node scripts/ci/agent-coordination.mjs task-create ...`

`node scripts/ci/agent-coordination.mjs task-claim --task=<id> --session=<id> --agent=<id>`

The control plane rejects overlapping active RCA or mutable scope ownership. Dependencies must be complete before a task is claimable.

A claimed task is not complete until its exact exit SHA, evidence, findings, remaining work, and RCA state are recorded.

## ROOT-CAUSE-FIRST REPAIR PROTOCOL

Every repair MUST be treated as root-cause elimination, never symptom suppression.

Before code changes, the agent MUST assign a unique RCA-ID and record the failure mechanism: `trigger → propagation path → violated invariant → responsible source → observable symptom`.

The repair MUST correct or remove the responsible source. These are explicitly invalid as root-cause repairs: weakening assertions, suppressing errors, adding silent skips, broadening allowlists, changing expected values to match broken behavior, retrying deterministic failures, deleting coverage, or moving the failure to another layer.

Every repair MUST add or strengthen a targeted regression that fails on the pre-repair behavior and passes because the causal defect is fixed. The regression MUST exercise the affected contract or its nearest authoritative boundary.

RCA closure requires all five proofs: `mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure`.

A repair that creates a new failure is not closed. The new failure receives its own RCA-ID and recovery continues from the new exact SHA.

`VERIFIED` is forbidden while the RCA remains open, a symptom workaround remains, required coverage was removed, or an independent root cause remains unresolved.

## PROTOCOL HIERARCHY

The normative hierarchy and anti-bloat gate are defined in `docs/PROTOCOL-HIERARCHY.md`, while `docs/PROTOCOL-REGISTRY.json` is the canonical machine-readable inventory of approved protocols.

When protocol rules conflict, precedence is: Master execution and safety contract → Zero-False-Green/evidence integrity → Root-Cause-First Repair → G1/G2/G3/G4 and release contracts → Change-Scope Integrity/Dependency-Graph Closure → testing/certification/collaboration/coordination/recovery → CI optimization.

No new standalone protocol may be introduced unless a recurring failure class is proven, existing controls are insufficient, the invariant and authoritative enforcement boundary are named, a regression/enforcement test is defined, and duplication/conflict analysis passes. Extend an existing protocol when it can absorb the requirement without ambiguity.

## OWNERSHIP

Each active agent MUST declare its RCA and file/contract scope. One active owner per RCA and one active owner per mutable scope unless an explicit handoff transfers ownership.

If `main` moves, refresh the exact `main` SHA and synchronize `execution` before continuing. Stale task packets or sessions must not be used as current repository state.

## EXECUTION LEDGER

Meaningful work follows:

`READ → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK → CHANGE ON execution → TARGETED REGRESSION → RECORD BATCH COUNT → BATCH CI → EXACT-SHA PROOF → MERGE execution → main → VERIFY main → SYNC execution → HANDOFF`

The session record MUST preserve actual commands, scope, SHA lineage, evidence, findings, and batch membership.

## ZERO-FALSE-GREEN

Agents MUST NOT weaken assertions, disable tests, add silent skips, relabel failures without evidence, reuse stale evidence, or declare GREEN from partial execution.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are recovery states.

## HANDOFF / LOGOUT

Every completed session MUST logout using:

`node scripts/ci/agent-session.mjs logout --session=<id> --agent=<id> --status=VERIFIED|BLOCKED`

Logout automatically writes:

`diagnostics/agents/handoffs/<session-id>.json`

The report MUST preserve:

`completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent`

along with `exitSha`, changed files, commands, evidence, findings, RCA closure/open state, and current batch count.

The next agent MUST ingest the predecessor report before executing inherited work. Handoff reports are continuity evidence, not certification evidence.

## Repository test contract

The repository uses one automatic test workflow: `.github/workflows/ci.yml`.

- `verify` is the single non-browser engine. It installs dependencies once, executes the canonical static contracts, performs the canonical production build, and publishes one immutable artifact identified by exact commit SHA and package-lock digest.
- `browser_fast` is the only fast browser engine: 22 canonical tools × Chromium/Firefox/WebKit = 66 execution units.
- `browser_deep` is the same browser engine in deep mode: canonical public-route localization/runtime coverage across 20 locales and Chromium/WebKit/Firefox. It runs on main/release paths, not the routine execution path.
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

**MANDATORY ENTRY: `PROJECTS.md` → `المهام.md` → `AGENTS.md` → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK SCOPE → EXECUTE ON `execution` → TARGETED REGRESSION → BATCH VERIFICATION → EXACT-SHA PROOF → MERGE `execution` → `main` → HANDOFF.**
