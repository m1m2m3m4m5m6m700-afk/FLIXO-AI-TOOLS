# 🔐 FLIXO Multi-Agent Collaboration Protocol v5

## Mandatory entry contract
`AGENTS.md` is the MANDATORY ENTRY TITLE for autonomous coding, debugging, CI, auditing, recovery, and release work.

Before repository action, the agent MUST read `AGENTS.md`, this protocol, `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`, `docs/AGENT-COORDINATION-CONTROL-PLANE.md`, `docs/PROTOCOL-HIERARCHY.md`, `docs/PROTOCOL-REGISTRY.json`, `docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json`, the CI architecture, test plan, assertion registry, and the current exact `main` SHA/workflow state.

Reading is part of the execution contract.

## Assistant ↔ execution-agent cooperation contract
Three roles exist:
- **Assistant/controller:** interprets user intent, plans, prioritizes, reviews evidence, challenges ambiguity, and decides continue/narrow/escalate/close.
- **Execution agent:** investigates, performs bounded mutations, verifies, records provenance, challenges unsafe instructions, and returns machine-readable evidence.
- **Certification authority:** independently certifies repository state; neither controller nor execution agent may self-certify.

Every material delegation uses:
`messageId + actor + intent + taskId + scope + entrySha + risk + expectedEvidence + stopConditions + proofObligations`.

Every completion returns:
`status + exitSha + changedFiles + commands + evidenceRefs + remainingWork + openRcas + nextAction + decisionTrace + verificationState`.

## Cooperation laws
1. **Explicit intent:** no invented broader objective.
2. **Bounded authority:** user intent cannot bypass policy, protected paths, security gates, locks, or certification.
3. **Evidence over assertion:** no PASS/VERIFIED/FIXED/DEPLOYED/CLOSED without exact-SHA evidence.
4. **Fresh-state rule:** stale handoffs are input, never proof; repository movement invalidates stale assumptions.
5. **Checkpoint before risk:** high-risk mutation requires RCA, scope, risk, rollback, regression and stop conditions.
6. **Challenge-before-mutation:** ambiguous, contradictory, stale, causally weak, or insufficient instructions MUST be challenged before mutation.
7. **No silent scope expansion:** new work becomes a new task/RCA or an explicitly approved scope extension with refreshed evidence.
8. **Stop-and-escalate:** protected-path, destructive, security-sensitive, ambiguous, conflicting, malformed-evidence, or authority-boundary events stop execution.
9. **Independent review:** HIGH and CRITICAL changes require a verification pass distinct from the mutation author.
10. **Independent certification:** coordination state never substitutes for canonical certification.
11. **Structured feedback:** failures return evidence, RCA, failed strategy, commands, remaining work, and safest next action.
12. **Learning without authority:** memory, confidence, prior success and anti-lessons guide strategy but never grant permissions or weaken gates.
13. **Decision trace:** material decisions record rationale, rejected alternatives, evidence basis, risk class, and reviewer/verification state.
14. **Handoff integrity:** ownership transfers only through a closed session handoff with exact SHA, RCA state, evidence and next plan.
15. **User-agency preservation:** unresolved product choices remain explicit decisions rather than hidden irreversible assumptions.

## Agent login
Before changing repository state, register `diagnostics/agents/sessions/<sessionId>.json` through `scripts/ci/agent-session.mjs`.

Required session fields include `schemaVersion, sessionId, agentId, role, entrySha, baseSha, startedAt, scope, readFiles, currentRca, status`.

When a prior handoff exists, continuation requires:
`node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --from-session=<previous-session> ...`

Only the first chain may use `--bootstrap=true`.

## Central coordination control plane
Canonical control plane:
- `diagnostics/agents/coordination-state.json`
- `diagnostics/agents/coordination-locks.json`
- `diagnostics/agents/task-packets/<TASK_ID>.json`
- `scripts/ci/agent-coordination.mjs`

Tasks are claimed before implementation. Dependencies must be DONE before dependent claims. Overlapping RCA/file scopes have one active owner. Conflicts MUST fail closed.

## Ownership lock
Every active session declares `RCA + file scope + contract scope + execution surface`. If `main` moves, refresh the exact SHA before continuing.

## Action ledger
`READ → INGEST HANDOFF → PLAN → ROOT-CAUSE ANALYSIS → LOCK → CLAIM TASK → CHANGE → TARGETED REGRESSION → AFFECTED CONTRACT VERIFICATION → INDEPENDENT REVIEW (when required) → EXACT-SHA PROOF → HANDOFF`

## Root-Cause-First Repair Protocol
Every persistent repair records:
`trigger → propagation path → violated invariant → responsible source → observable symptom`.

The causal source must be corrected. Weakening assertions, suppressing errors, silent skips, broad allowlists, accommodating expected values, deterministic retries, deleting coverage, changing test ownership to evade failure, or moving the defect to another layer are not repairs.

Every repair needs a targeted regression that fails before the repair and passes because the causal defect is corrected, plus affected dependency/contract graph verification.

RCA closure requires:
`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure`.

A new deterministic failure gets a new RCA-ID. A session MUST NOT report VERIFIED with an open RCA, symptom-only workaround, removed required coverage, or unresolved independent root cause.

## Canonical protocol registry
`docs/PROTOCOL-REGISTRY.json` is the single protocol inventory. It contains exactly 20 mandatory protocols. Compatible requirements MUST extend an existing protocol rather than create a duplicate. P20 now governs agent ownership, continuity, handoff, challenge-before-mutation, decision provenance, and risk-tiered independent review.

## Mandatory session handoff report
Every completed session creates `diagnostics/agents/handoffs/<sessionId>.json` through `scripts/ci/agent-session.mjs logout`.

The report separates `completedWork`, `failedWork`, `remainingWork`, `executionPlanNext`, `blockers`, and `handoffToNextAgent`, and records exact entry/exit SHA, RCA state, changed files, commands and evidence.

Handoff is continuity evidence only, never certification evidence.

## Evidence and provenance
Primary evidence MUST be attributable to one exact SHA and one run. Diagnostic evidence cannot be promoted into primary certification evidence. Malformed or stale evidence is non-success.

## Failure and RCA
`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are non-success states.

## Conflict protocol
1. Freeze conflicting scope.
2. Compare session IDs and base/exit SHAs.
3. Compare handoffs.
4. Query coordination locks.
5. Select newest authoritative repository state.
6. Retain one owner.
7. Record transfer.
8. Re-run affected verification on resulting exact SHA.

No silent conflict resolution.

## Certification separation
Agents produce evidence; only canonical certification may issue final repository certification.

## Logout
A session ends only as VERIFIED or BLOCKED through `scripts/ci/agent-session.mjs logout`.
VERIFIED is forbidden while failed work, remaining work, or open RCAs exist. BLOCKED requires an explicit unresolved item.

## Enforcement
CI MUST verify the mandatory entry gate, collaboration protocol, protocol hierarchy, canonical protocol registry, handoff schema, coordination control plane, session tool, Root-Cause-First Repair Protocol, assistant-agent cooperation contract, and centralized repair-proof controls.

Removing, bypassing, weakening, duplicating, or silently ignoring these controls MUST fail the repository contract gate.

This protocol coordinates agents; it is not an authentication mechanism. Repository evidence remains authoritative.
