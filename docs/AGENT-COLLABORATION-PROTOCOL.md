# 🔐 FLIXO Multi-Agent Collaboration Protocol v1

## Mandatory entry contract

`AGENTS.md` is the repository-wide entry title for every autonomous agent performing coding, debugging, testing, CI, auditing, recovery, or release work.

Before any repository action, every agent MUST read:

1. `AGENTS.md`
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
4. `scripts/ci/test-plan.json`
5. `scripts/ci/assertion-registry.json`
6. the current exact `main` SHA and current workflow state

Reading is part of the execution contract.

## Agent login

Before changing repository state, an agent MUST register a unique session at:

`diagnostics/agents/sessions/<sessionId>.json`

Required fields:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`

Initial status: `RUNNING`.

## Ownership lock

Every active session declares:

`RCA + file scope + contract scope + execution surface`.

There is one active owner per RCA and one active owner per mutable file scope unless ownership is explicitly transferred through a handoff.

If `main` moves, the agent MUST refresh the current exact SHA before continuing.

## Action ledger

Meaningful work follows:

`READ → PLAN → LOCK → CHANGE → VERIFY → HANDOFF`

The session record MUST retain the actual commands/actions and exact SHA lineage. It MUST NOT claim work that did not occur.

## Handoff

Every completed session records:

`sessionId, agentId, entrySha, exitSha, RCA status, changedFiles, commands, evidence, findings, rcaClosed, openRcas, handoff`.

The next agent must be able to continue without guessing what the previous agent changed or verified.

## Evidence and provenance

Primary evidence MUST be attributable to one exact SHA and one run.

Agents MUST NOT reuse stale evidence, convert diagnostic evidence into primary evidence, mask malformed evidence, or declare PASS from a summary without supporting execution records.

## Failure and RCA

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are non-success states.

Persistent failures receive a Root Cause ID. Closure requires:

`mechanism identified → repair → targeted regression → affected contract verification → fresh exact-SHA proof → CLOSED`.

## Conflict protocol

When two agents overlap:

1. Freeze the conflicting scope.
2. Compare session IDs and base SHAs.
3. Identify the newest authoritative state.
4. Retain one active owner.
5. Record the transfer in handoff.
6. Re-run affected verification on the resulting exact SHA.

No silent conflict resolution.

## Certification separation

Agents may produce evidence and diagnostics, but only the canonical certification authority may issue the repository's final certification result.

## Logout

A session ends only as `VERIFIED` or `BLOCKED` and records `exitSha`, evidence, findings, RCA closure/open state, and handoff.

## Enforcement

CI MUST verify that the mandatory entry gate, this protocol, and the session tool exist and retain their required contract markers. Removing or bypassing this collaboration protocol MUST fail the repository contract gate.

This protocol coordinates agents; it is not an authentication mechanism. Repository evidence remains authoritative.
