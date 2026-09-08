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

Use the canonical session tool:

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

The next agent must be able to continue without guessing what the previous agent changed or verified.

**MANDATORY ENTRY TITLE: READ FIRST → LOGIN → LOCK SCOPE → EXECUTE → VERIFY → HANDOFF.**
