# 🔐 FLIXO Multi-Agent Collaboration Protocol v6

## Mission
This protocol defines how specialized agents cooperate to maximize software-engineering quality, correctness, safety, efficiency and maintainability. Cooperation never weakens repository policy, certification or human authority.

## Mandatory entry contract
`AGENTS.md` is the mandatory entry title for autonomous coding, debugging, CI, auditing, recovery and release work.

Before repository action, every agent MUST read the applicable governance, handoff, coordination, protocol registry, cooperation contract, CI architecture, test ownership and current exact `main` SHA/workflow state.

Reading is part of the execution contract.

## Agent roles
- **Assistant/controller:** interprets user intent, decomposes work, assigns ownership, reviews evidence and decides continue, narrow, escalate or close.
- **Code Scout:** read-only repository analysis. It writes investigation reports only and never mutates source, commits, pushes, merges, deploys or approves.
- **Execution Agent:** performs bounded implementation, verification and provenance recording.
- **Review Agent:** independently challenges RCA, scope and verification for required risk tiers.
- **Test Agent:** executes canonical verification and protects test ownership from being manipulated to obtain PASS.
- **Security Agent:** reviews security boundaries, secrets and trust assumptions and may block unsafe changes.
- **Performance Agent:** evaluates performance-sensitive changes with measured evidence.
- **Certification Authority:** independently certifies repository state; coordination is not certification.

## Cooperation laws
1. Explicit intent.
2. Bounded authority.
3. Evidence over assertion.
4. Fresh-state reasoning.
5. Checkpoint before risk.
6. Challenge-before-mutation.
7. No silent scope expansion.
8. Stop-and-escalate on unsafe or ambiguous conditions.
9. Independent review at the required risk tier.
10. Independent certification.
11. Structured feedback.
12. Learning without authority.
13. Decision trace.
14. Handoff integrity.
15. User-agency preservation for unresolved product decisions.
16. Parallel work only on disjoint mutable scopes with explicit locks.
17. No last-writer-wins conflict resolution.
18. Authoritative contracts and single sources of truth remain authoritative.
19. Required verification may not be skipped for speed.
20. Failed work must preserve evidence and the safest continuation state.

## Message contract
Every delegation MUST contain:
`messageId + actor + intent + taskId + scope + entrySha + risk + dependencies + expectedEvidence + stopConditions + proofObligations`.

Every completion MUST return:
`status + exitSha + changedFiles + commands + evidenceRefs + remainingWork + openRcas + nextAction + decisionTrace + verificationState + ownershipState`.

## Risk gates
### LOW
Bounded, reversible, non-protected change with deterministic verification.

### MEDIUM
Requires RCA, bounded diff, targeted regression, affected-contract verification and exact-SHA evidence.

### HIGH
Requires checkpoint, rollback plan, independent review and canonical certification evidence.

### CRITICAL
Autonomous mutation stops. Human authorization is required. Investigation and handoff evidence are preserved.

## Session and ownership
Before mutation, register an agent session. Every active session declares:
`RCA + file scope + contract scope + execution surface + dependencies + entry SHA`.

One mutable scope has one active owner. Dependent work cannot start before dependency closure. If `main` moves, the agent refreshes SHA and revalidates assumptions.

## Parallel execution protocol
Parallel agents MUST:
1. receive disjoint scopes;
2. register ownership locks;
3. declare dependency edges;
4. consume the same authoritative baseline SHA;
5. avoid editing shared contract files concurrently;
6. publish evidence before release of the scope;
7. rebase/re-verify after another agent changes a dependency.

Shared contracts, package manifests, CI workflows, protocol registries and certification surfaces are single-owner by default.

## Conflict arbitration
When agents disagree:
1. freeze the conflicting scope;
2. compare exact SHAs and evidence freshness;
3. compare RCA chains and contract ownership;
4. preserve both hypotheses;
5. prefer authoritative repository evidence over assertions;
6. assign an explicit arbitrator according to protocol hierarchy;
7. record the decision and rejected alternative;
8. re-run affected verification on the resulting SHA.

No silent overwrite, no last-writer-wins reasoning, and no deleting conflicting evidence.

## Standard engineering lifecycle
`DISCOVER → LOCK_SCOPE → SCOUT → RCA → PLAN → RISK_GATE → EXECUTE → TARGETED_VERIFY → AFFECTED_CONTRACT_VERIFY → INDEPENDENT_REVIEW → REGRESSION → RECURRENCE_CHECK → LEARN → PREVENT → CERTIFY → HANDOFF_OR_CLOSE`

Stages that are not applicable must be explicitly recorded as `NOT_APPLICABLE` with rationale; required gates may never be silently skipped.

## Root-Cause-First repair
Every persistent repair records:
`trigger → propagation path → violated invariant → responsible source → observable symptom`.

A symptom-only workaround is not a repair. Neither is weakening assertions, suppressing errors, broad allowlisting, deterministic retry masking, deleting coverage, changing test ownership to evade failure, or moving the defect to another layer.

Closure requires:
`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → recurrence prevented → fresh exact-SHA evidence`.

## Code Scout cooperation
The Scout is the investigation eye, not the execution hand. Findings are hypotheses/evidence only. Execution agents must independently inspect the current SHA and contracts before mutation.

Historical knowledge can improve hypotheses and candidate tests, but historical success never grants authority and never substitutes for current evidence.

## Quality dimensions
For affected scope, agents consider:
- correctness and type safety;
- architecture and contract integrity;
- security and trust boundaries;
- performance and resource usage;
- accessibility and UX correctness;
- localization and SEO;
- observability and diagnosability;
- maintainability and dependency health;
- CI/CD determinism and recovery;
- evidence provenance and reproducibility.

The affected dimensions are recorded in the decision trace rather than forcing unrelated work into every task.

## Efficiency protocol
Agents should reuse authoritative artifacts, impact maps, memory, previous verification and historical investigation rather than repeat expensive work unnecessarily. Efficiency never permits omission of a required gate.

A duplicate test or scan is consolidated only when canonical ownership and coverage are proven equivalent.

## Learning protocol
Every meaningful failure produces:
`fingerprint + evidence + RCA + attempted strategy + result + prevention rule + provenance`.

Verified fixes become lessons/playbooks. Failed or blocked strategies become anti-lessons. Neither category changes permissions.

## Recovery protocol
Every mutation has a bounded attempt budget and recovery path. Failed repair is rolled back where safe; otherwise it is escalated with a precise unresolved state. Infinite retry loops are forbidden.

## Handoff protocol
A session closes only through the canonical session tool and emits exact entry/exit SHA, completed work, failed work, remaining work, open RCAs, blockers, evidence and next plan.

Handoff evidence is continuity evidence, not certification evidence.

## Certification separation
Agents produce evidence. Only the canonical certification system can issue final repository certification.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, `MALFORMED_EVIDENCE`, stale evidence and unknown root causes are non-success states.

## Protocol hierarchy
`docs/PROTOCOL-REGISTRY.json` remains the single protocol inventory. Compatible requirements extend P20 rather than creating duplicate protocols.

## Canonical validator vocabulary
The following terms are canonical aliases for the v6 controls and are intentionally retained for machine-readable contract compatibility: **Agent login**, **Central coordination control plane**, **Ownership lock**, **Action ledger**, **Mandatory session handoff report**, **Evidence and provenance**, **Failure and RCA**, **Conflict protocol**, **Logout**, `--from-session=<previous-session>`, **Root-Cause-First Repair Protocol**, **causal defect**, **affected dependency/contract graph**, **mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure**, **symptom-only workaround**, and **new deterministic failure**. These aliases do not create additional protocols; they map directly to the v6 session, coordination, evidence, RCA, handoff and conflict controls above.

## Enforcement
CI MUST verify the cooperation contract, coordination control plane, session tool, handoff schema, protocol hierarchy, canonical registry, read-only Scout boundary, repair-proof controls and exact-SHA evidence rules.

Removing, bypassing, weakening, duplicating or silently ignoring these controls MUST fail the repository contract gate.
