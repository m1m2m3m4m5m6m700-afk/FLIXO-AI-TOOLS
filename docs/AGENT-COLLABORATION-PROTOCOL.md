# 🔐 FLIXO Multi-Agent Collaboration Protocol v2

## Mandatory entry contract

`AGENTS.md` is the repository-wide entry title for every autonomous agent performing coding, debugging, testing, CI, auditing, recovery, or release work.

Before any repository action, every agent MUST read:

1. `AGENTS.md`
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
4. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
5. `scripts/ci/test-plan.json`
6. `scripts/ci/assertion-registry.json`
7. the current exact `main` SHA and current workflow state

Reading is part of the execution contract.

## Agent login

Before changing repository state, an agent MUST register a unique session at:

`diagnostics/agents/sessions/<sessionId>.json`

Required fields include:

`schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

Initial status: `RUNNING`.

When a prior handoff exists, login MUST continue from a closed predecessor session:

`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --from-session=<previous-session> ...`

The only exception is an explicit first-chain bootstrap using `--bootstrap=true`.

A continuation login records the predecessor's `exitSha`, unresolved work, open RCAs, and next execution plan in the new session.

## Ownership lock

Every active session declares:

`RCA + file scope + contract scope + execution surface`.

There is one active owner per RCA and one active owner per mutable file scope unless ownership is explicitly transferred through a handoff.

If `main` moves, the agent MUST refresh the current exact SHA before continuing.

## Action ledger

Meaningful work follows:

`READ → PLAN → LOCK → CHANGE → VERIFY → HANDOFF`

The session record MUST retain the actual commands/actions and exact SHA lineage. It MUST NOT claim work that did not occur.

## Mandatory session handoff report

Every completed session MUST create:

`diagnostics/agents/handoffs/<sessionId>.json`

using the canonical handoff report schema in `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`.

The report MUST state, explicitly and separately:

`completedWork` — actually performed and verified.

`failedWork` — attempted but not proven successful.

`remainingWork` — unresolved execution work.

`executionPlanNext` — ordered actions for the next session.

`blockers` — blockers that prevented closure.

`handoffToNextAgent` — explicit operational continuation instructions.

The next agent MUST ingest that report into its new session before executing the inherited plan. It MUST treat inherited work as input state, never as proof of completion.

## Handoff

Every completed session records:

`sessionId, agentId, entrySha, exitSha, RCA status, changedFiles, commands, evidence, findings, rcaClosed, openRcas, remainingWork, executionPlanNext, blockers, handoff`.

The next agent must be able to continue without guessing what the previous agent changed, verified, failed to verify, or intentionally left open.

## Evidence and provenance

Primary evidence MUST be attributable to one exact SHA and one run.

Agents MUST NOT reuse stale evidence, convert diagnostic evidence into primary evidence, mask malformed evidence, or declare PASS from a summary without supporting execution records.

Handoff reports are continuity evidence only. They are not certification evidence.

## Failure and RCA

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are non-success states.

Persistent failures receive a Root Cause ID. Closure requires:

`mechanism identified → repair → targeted regression → affected contract verification → fresh exact-SHA proof → CLOSED`.

## Conflict protocol

When two agents overlap:

1. Freeze the conflicting scope.
2. Compare session IDs and base/exit SHAs.
3. Compare inherited handoff reports.
4. Identify the newest authoritative repository state.
5. Retain one active owner.
6. Record the transfer in handoff.
7. Re-run affected verification on the resulting exact SHA.

No silent conflict resolution.

## Certification separation

Agents may produce evidence and diagnostics, but only the canonical certification authority may issue the repository's final certification result.

## Logout

A session ends only as `VERIFIED` or `BLOCKED` and MUST create the handoff report automatically through:

`node scripts/ci/agent-session.mjs logout ...`

`VERIFIED` is forbidden while failed work, remaining work, or open RCAs exist.

`BLOCKED` requires an explicit unresolved item.

## Enforcement

CI MUST verify that the mandatory entry gate, this protocol, the handoff schema, and the session tool exist and retain their required contract markers.

The session tool MUST enforce predecessor handoff continuity whenever a prior handoff exists, and MUST emit a machine-readable handoff report at logout.

Removing, bypassing, or silently ignoring the handoff protocol MUST fail the repository contract gate.

This protocol coordinates agents; it is not an authentication mechanism. Repository evidence remains authoritative.
