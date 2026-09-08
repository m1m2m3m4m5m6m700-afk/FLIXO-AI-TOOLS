# 🚨 AGENT ENTRY GATE — FLIXO-AI-TOOLS

This file is the mandatory entry point for every autonomous coding, debugging, CI, audit, recovery, or release agent.

## READ-BEFORE-ACTION

Before any repository action, every agent MUST read:

1. `AGENTS.md`
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
4. `scripts/ci/test-plan.json`
5. `scripts/ci/assertion-registry.json`
6. the current exact `main` SHA and current workflow state

Reading is part of execution and is not optional documentation.

## AGENT LOGIN

Before changing repository state, the agent MUST create:

`diagnostics/agents/sessions/<session-id>.json`

with:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

No session record means unauthorized repository execution.

Canonical login:

`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --rca=<RCA-ID> --scope=<scope>`

## OWNERSHIP

Each active agent MUST declare its RCA and file/contract scope. One active owner per RCA and one active owner per mutable scope unless an explicit handoff transfers ownership.

If `main` moves, refresh the exact SHA before continuing.

## EXECUTION LEDGER

Meaningful actions follow:

`READ → PLAN → LOCK → CHANGE → VERIFY → HANDOFF`

The session record MUST preserve actual commands, scope, SHA lineage, evidence, and findings.

## ZERO-FALSE-GREEN

Agents MUST NOT weaken assertions, disable tests, add silent skips, relabel failures without evidence, reuse stale evidence, or declare GREEN from partial execution.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are recovery states.

## HANDOFF / LOGOUT

Every completed session MUST logout using:

`node scripts/ci/agent-session.mjs logout --session=<id> --agent=<id> --status=VERIFIED|BLOCKED`

and record:

`exitSha, changedFiles, commands, evidence, findings, rcaClosed, openRcas, handoff`.

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

**MANDATORY ENTRY TITLE: READ FIRST → LOGIN → LOCK SCOPE → EXECUTE → VERIFY → HANDOFF.**
