# 🚨 AGENT ENTRY GATE — FLIXO-AI-TOOLS

This file is the mandatory entry point for every autonomous coding, debugging, CI, audit, or recovery agent operating in this repository.

## READ-BEFORE-ACTION

Before any repository action, every agent MUST read:

1. `AGENTS.md` (this file)
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
4. `scripts/ci/test-plan.json`
5. `scripts/ci/assertion-registry.json`
6. the current exact `main` SHA and current workflow state

Reading these contracts is part of execution. It is not optional documentation.

## AGENT LOGIN

Before changing repository state, the agent MUST create a session record under:

`diagnostics/agents/sessions/<session-id>.json`

The record MUST contain:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

No session record means unauthorized execution.

## OWNERSHIP

Each active session MUST declare its RCA and file/contract scope. One active owner per RCA and one active owner per mutable file scope, unless a recorded handoff transfers ownership.

If `main` moves, the agent MUST refresh its exact-SHA state before continuing.

## EXECUTION LEDGER

Meaningful actions follow:

`READ → PLAN → LOCK → CHANGE → VERIFY → HANDOFF`

A completed session MUST record:

`exitSha, changedFiles, commands, evidence, findings, rcaClosed, openRcas, handoff`.

The ledger MUST never claim work that did not occur.

## ZERO-FALSE-GREEN

Agents MUST NOT weaken assertions, disable tests, add silent skips, relabel failures without evidence, reuse stale evidence, or declare GREEN from a partial run.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are recovery states, not success states.

## HANDOFF

Every completed session MUST leave an auditable handoff so another agent can identify the exact SHA, scope, changes, evidence, findings, and remaining work without guessing.

**MANDATORY ENTRY TITLE: READ FIRST → LOGIN → LOCK SCOPE → EXECUTE → VERIFY → HANDOFF.**
