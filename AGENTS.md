# 🚨 AGENT ENTRY GATE — FLIXO-AI-TOOLS

This file is the mandatory entry point for every autonomous coding, debugging, CI, audit, recovery, or release agent.

## READ-BEFORE-ACTION

Before any repository action, every agent MUST read:

1. `AGENTS.md`
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
4. `docs/AGENT-COORDINATION-CONTROL-PLANE.md`
5. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
6. `scripts/ci/test-plan.json`
7. `scripts/ci/assertion-registry.json`
8. the current exact `main` SHA and current workflow state

Reading is part of execution and is not optional documentation.

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

## OWNERSHIP

Each active agent MUST declare its RCA and file/contract scope. One active owner per RCA and one active owner per mutable scope unless an explicit handoff transfers ownership.

If `main` moves, refresh the exact SHA before continuing. Stale task packets or sessions must not be used as current repository state.

## EXECUTION LEDGER

Meaningful work follows:

`READ → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK → CHANGE → TARGETED REGRESSION → AFFECTED CONTRACT VERIFICATION → EXACT-SHA PROOF → HANDOFF`

The session record MUST preserve actual commands, scope, SHA lineage, evidence, and findings.

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

along with `exitSha`, changed files, commands, evidence, findings, RCA closure/open state.

The next agent MUST ingest the predecessor report before executing inherited work. Handoff reports are continuity input, not certification evidence.

## Repository test contract

The repository uses one automatic test workflow: `.github/workflows/ci.yml`.

- `verify` is the single non-browser engine. It installs dependencies once, executes the canonical static contracts, performs the canonical production build, and publishes one immutable artifact identified by exact commit SHA and package-lock digest.
- `browser_fast` is the only fast browser engine: 22 canonical tools × Chromium/Firefox/WebKit = 66 execution units.
- `browser_deep` is the same browser engine in deep mode: canonical public-route localization/runtime coverage across 20 locales and Chromium/Firefox/WebKit. It runs on main/release paths, not the PR fast path.
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

**MANDATORY ENTRY TITLE: READ FIRST → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK SCOPE → EXECUTE → TARGETED REGRESSION → VERIFY → EXACT-SHA PROOF → HANDOFF.**
