# 🔐 FLIXO Multi-Agent Collaboration Protocol v3

## Mandatory entry contract

`AGENTS.md` is the repository-wide entry title for every autonomous agent performing coding, debugging, CI, auditing, recovery, or release work.

Before any repository action, every agent MUST read:

1. `AGENTS.md`
2. `docs/AGENT-COLLABORATION-PROTOCOL.md`
3. `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
4. `docs/AGENT-COORDINATION-CONTROL-PLANE.md`
5. `docs/PROTOCOL-HIERARCHY.md`
6. `docs/PROTOCOL-REGISTRY.json`
7. `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
8. `scripts/ci/test-plan.json`
9. `scripts/ci/assertion-registry.json`
10. the current exact `main` SHA and current workflow state

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

## Central coordination control plane

All multi-agent execution MUST use the canonical control plane:

`diagnostics/agents/coordination-state.json`

`diagnostics/agents/coordination-locks.json`

`diagnostics/agents/task-packets/<TASK_ID>.json`

The canonical coordinator is `scripts/ci/agent-coordination.mjs`.

Tasks are claimed before implementation. Task dependencies must be complete before a dependent task is claimable. One active owner is allowed for each RCA and each overlapping mutable scope. Conflicting claims MUST fail closed.

A task cannot become `DONE` while `remainingWork` or `openRcas` exist.

## Ownership lock

Every active session declares:

`RCA + file scope + contract scope + execution surface`.

There is one active owner per RCA and one active owner per mutable file scope unless ownership is explicitly transferred through a handoff.

If `main` moves, the agent MUST refresh the current exact SHA before continuing.

## Action ledger

Meaningful work follows:

`READ → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK → CLAIM TASK → CHANGE → TARGETED REGRESSION → AFFECTED CONTRACT VERIFICATION → EXACT-SHA PROOF → HANDOFF`

The session record MUST retain the actual commands/actions and exact SHA lineage. It MUST NOT claim work that did not occur.

## Root-Cause-First Repair Protocol

Every repair MUST eliminate the causal defect, not merely hide its observable symptom.

Before code changes, the active owner MUST assign a unique RCA-ID and record the causal chain:

`trigger → propagation path → violated invariant → responsible source → observable symptom`.

The fix MUST correct or remove the responsible source. The following are explicitly non-repairs: weakening assertions, suppressing errors, silent skips, broad allowlists, expected-value changes that accommodate broken behavior, retries of deterministic failures, deleting coverage, changing test ownership to evade failure, or moving the same defect to another layer.

Every repair MUST include a targeted regression that fails against the pre-repair behavior and passes because the causal defect is corrected. The regression belongs at the affected contract boundary or the nearest authoritative boundary.

Every repair MUST also verify the affected dependency/contract graph, because a local green test does not prove system-level correctness.

RCA closure is valid only when all five proof obligations are satisfied:

`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure`.

A repair that causes a new deterministic failure is not closed. The new defect receives its own RCA-ID and recovery resumes from the new exact SHA.

A session MUST NOT report `VERIFIED` while an RCA is open, a symptom-only workaround remains, required coverage was removed, or an independent root cause remains unresolved.

## Canonical protocol registry

`docs/PROTOCOL-REGISTRY.json` is the single machine-readable inventory of approved execution protocols. It currently contains exactly 20 mandatory protocols grouped by family. Protocol identity, status, invariant, and authoritative enforcement boundary MUST be maintained there.

Agents MUST NOT create a parallel protocol inventory in another file. Requirements that belong to an existing registry protocol MUST extend that protocol rather than create a duplicate.

## Mandatory session handoff report

Every completed session MUST create:

`diagnostics/agents/handoffs/<sessionId>.json`

using the canonical handoff report schema in `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`.

The report MUST state, explicitly and separately:

`completedWork` — actually performed and verified.

`failedWork` — attempted but not proven successful.

`remainingWork` — unresolved execution work.

`executionPlanNext` — ordered continuation plan. The next agent MUST ingest it as input state and MUST NOT treat it as proof of completion.

`blockers` — blockers that prevented closure.

`handoffToNextAgent` — explicit operational continuation instructions.

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

Persistent failures receive a Root Cause ID. Closure requires the full Root-Cause-First Repair Protocol; a green symptom without causal closure is not success.

## Conflict protocol

When two agents overlap:

1. Freeze the conflicting scope.
2. Compare session IDs and base/exit SHAs.
3. Compare inherited handoff reports.
4. Query the coordination lock ledger.
5. Identify the newest authoritative repository state.
6. Retain one active owner.
7. Record the transfer in handoff.
8. Re-run affected verification on the resulting exact SHA.

No silent conflict resolution.

## Certification separation

Agents may produce evidence and diagnostics, but only the canonical certification authority may issue the repository's final certification result.

## Logout

A session ends only as `VERIFIED` or `BLOCKED` and MUST create the handoff report automatically through:

`node scripts/ci/agent-session.mjs logout ...`

`VERIFIED` is forbidden while failed work, remaining work, or open RCAs exist.

`BLOCKED` requires an explicit unresolved item.

## Enforcement

CI MUST verify that the mandatory entry gate, this protocol, the protocol hierarchy, the canonical protocol registry, the handoff schema, the coordination control plane, the session tool, and the Root-Cause-First Repair Protocol exist and retain their required contract markers.

The session tool MUST enforce predecessor handoff continuity whenever a prior handoff exists, and MUST emit a machine-readable handoff report at logout.

The coordination tool MUST reject overlapping active ownership and incomplete dependencies.

Removing, bypassing, weakening, duplicating, or silently ignoring the collaboration, coordination, protocol hierarchy, protocol registry, or root-cause repair controls MUST fail the repository contract gate.

This protocol coordinates agents; it is not an authentication mechanism. Repository evidence remains authoritative.
