# FLIXO Multi-Agent Collaboration Protocol v7

## Mission
This protocol defines the operating system for the FLIXO agent team. The executive controller coordinates two primary runtime agents: **Task Agent** (preparation/implementation intelligence) and **Error Agent** (failure detection, diagnosis and root-cause intelligence). Supporting roles remain logical review/test/security/performance/certification functions and are invoked by risk and scope, not as uncontrolled independent writers.

Cooperation never weakens repository policy, certification or human authority.


## Central Repair Protocol Invariant

```text
REPAIR_SESSION
  → PROTOCOL_VALIDATION
  → FAILURE_CAPTURE
  → MUTATION
  → TARGETED_RETEST
  → RESUME_REMAINING_TESTS
  → FINAL_VERIFICATION
  → COMMIT_BOUNDARY
```

The machine-readable authority is `scripts/ci/repair-protocol.mjs`. Prompt text and agent-local interpretations are non-authoritative. Every agent entering the control plane is admitted against the same protocol version and hash.

A new failure discovered inside an active repair session is an **In-Flight Failure**. The allowed sequence is repair, targeted retest, then resume of remaining required verification. A new session or new commit is not created merely because another failure appears in the same causal repair boundary.

**ONE COMMIT IS THE RESULT OF A COMPLETED REPAIR SESSION, NOT THE RESPONSE TO EACH INDIVIDUAL FAILURE.** An additional commit requires a separately proven independent boundary.

No agent may bypass, weaken, reinterpret, or locally redefine the Repair Protocol. Mutation of its protected control-plane source during ordinary repair is blocked.

## Required machine-readable collaboration markers
The following terms are normative coordination controls and are intentionally explicit so CI can verify the contract without relying on semantic inference:
- **Assistant/controller** — the Executive Controller owns orchestration, integration and final execution decisions.
- **Execution Agent** — performs only bounded, ownership-locked execution work authorized by the controller.
- **Evidence over assertion** — exact-SHA evidence is authoritative; claims never substitute for evidence.
- **Stop-and-escalate** — stop when evidence, authority, scope or safety is insufficient and preserve the handoff state.
- **Challenge-before-mutation** — ambiguous, stale, contradictory or causally weak instructions must be challenged before mutation.
- **Independent review** — required risk-tier changes receive review from an actor distinct from the mutation author.
- **Decision trace** — material decisions record rationale, evidence basis, risk, alternatives, owner and reviewer state.
- **Parallel execution protocol** — parallel work is permitted only for disjoint scopes with explicit locks, barriers and one authoritative baseline.
- **Conflict arbitration** — conflicting findings are preserved and resolved against exact-SHA evidence by explicit authority; no last-writer-wins behavior.
- **Quality dimensions** — correctness, security, maintainability, performance, accessibility, localization, observability and operability are evaluated according to affected scope.

## Scout evidence consumption invariant
**MANDATORY FOR EVERY MUTATION:** before the Executive Controller or any authorized Execution Agent changes a repository file, it MUST consume the latest applicable Code Scout report for the current investigation scope and exact baseline SHA, when a Scout report is required by the lifecycle/risk gate. The report must be treated as evidence, not as authorization.

For every mutation decision, the controller MUST record:
`scoutReportRef + scoutEntrySha + scoutFreshness + findingsConsumed + findingsRejected(with reason) + affectedScope + decisionTrace`.

The mutation gate MUST stop when a required Scout report is missing, stale, malformed, scope-incompatible, or based on a different authoritative SHA. The agent must re-scout or explicitly record `SCOUT_NOT_APPLICABLE` with rationale when the lifecycle/risk rules permit skipping the Scout stage. A Scout finding that is contradicted by fresh exact-SHA evidence must be preserved, challenged and resolved; it may not be silently ignored.

This rule applies to fixes, refactors, workflow/configuration changes, dependency changes, generated-contract changes and certification-surface changes. It does not require a redundant scan for a purely mechanical follow-up mutation when the controller records why the existing Scout evidence remains valid for the unchanged scope and baseline.

## Command structure
```text
USER INTENT
    ↓
EXECUTIVE CONTROLLER (ChatGPT)
    ├─ owns orchestration and final execution decisions
    ├─ resolves conflicts and stale state
    ├─ reviews evidence
    ├─ consumes Scout evidence before mutation
    ├─ may adapt/apply/test authorized changes
    └─ commits/pushes only when explicitly requested
          │
          ├───────────────┐
          ↓               ↓
    TASK AGENT       ERROR AGENT
    prepare work     detect + diagnose
    from مهام.md     failures + RCA
          │               │
          └───────┬───────┘
                  ↓
          EXECUTIVE INTEGRATION GATE
                  ↓
       APPLY → TARGETED VERIFY → REGRESSION
                  ↓
          INDEPENDENT REVIEW
                  ↓
       RECURRENCE → LEARN → CERTIFY
```

**No agent bypasses the Executive Integration Gate.** Preparation, diagnosis, execution and certification are separate authorities.

## Mandatory entry contract
`AGENTS.md` is the mandatory entry title for autonomous coding, debugging, CI, auditing, recovery and release work.

Before repository action, every agent MUST read applicable governance, handoff, coordination, protocol registry, cooperation contract, CI architecture, test ownership and the current exact `main` SHA/workflow state.

## Agent roles and authority
- **Executive Controller:** interprets user intent, selects/coordinates work, owns integration decisions, reviews evidence, arbitrates conflicts, adapts prepared changes, applies authorized changes, runs verification, and decides continue/narrow/escalate/close. It cannot declare certification without canonical evidence.
- **Task Agent:** exclusive owner of `مهام.md` task intelligence. It understands the active task, resolves dependencies, inspects relevant code/contracts and prepares exact code/test changes. **PREPARATION_ONLY**: no source mutation, commit, push, PR, merge or closure.
- **Error Agent:** exclusive failure-intelligence owner. It consumes CI/runtime/test/deployment failure evidence, fingerprints and deduplicates failures, reproduces where possible, traces causal propagation, identifies violated invariants, maps affected contract/dependency scope, classifies deterministic/flaky/infrastructure failures, and emits a diagnosis packet. It MUST NOT mutate source, commit, push, merge or declare a fix verified.
- **Code Scout:** read-only repository analysis. **SCOUT** is the canonical lifecycle marker for this read-only inspection stage.
- **Review Agent:** independently challenges RCA, scope and verification for required risk tiers.
- **Test Agent:** executes canonical verification and protects test ownership from manipulation.
- **Security Agent:** reviews security boundaries, secrets and trust assumptions and may block unsafe changes.
- **Performance Agent:** evaluates performance-sensitive changes with measured evidence.
- **Certification Authority:** independently certifies repository state.

## Error Agent contract
Every diagnosis MUST contain:
`failureFingerprint + trigger + exactFailureEvidence + entrySha + runIdentity + environment + reproductionState + propagationPath + violatedInvariant + causalSource + affectedScope + dependencyGraph + recurrenceSignals + confidence + stopConditions + nextAction`.

The Error Agent MUST:
1. prefer fresh exact-SHA evidence;
2. distinguish symptom, trigger, propagation and causal source;
3. search existing error memory before opening a new repair hypothesis;
4. classify duplicates and recurrence without hiding new evidence;
5. distinguish deterministic failure, flake, infrastructure/provider failure, contract failure and unknown cause;
6. mark unknown RCA as `UNKNOWN_RCA` rather than guessing;
7. identify the smallest complete affected scope;
8. propose verification obligations that can falsify its RCA;
9. hand off immutable diagnosis evidence to the Executive Controller and Task Agent;
10. stop when evidence is insufficient or risk becomes CRITICAL.

A diagnosis is **not** a repair, and confidence is not proof.

## Task Agent contract
The Task Agent consumes `مهام.md` plus authoritative diagnosis/handoff evidence. It must bind preparation to:
`taskId + baselineSha + contractVersion + errorFingerprint/RCA(if applicable) + scope + dependencies + proofObligations`.

It may prepare source/test code artifacts, but those artifacts are proposals until the Executive Controller independently reviews and applies them.

## Communication-first execution invariant

The existing agent communication architecture is the first operational dependency for every agent.

```text
NOTIFICATION
  → MASTER INBOX
  → EVENT-DRIVEN RELAY
  → RECEIVE
  → READ
  → EXACT-SHA REVALIDATION
  → OWNERSHIP / RCA / DEPENDENCY CHECK
  → EXECUTE
```

The canonical ingress is the existing Master Inbox at GitHub Issue #761. The event-driven adapter is `.github/workflows/agent-communication-relay.yml`. The machine-readable inbox lifecycle is implemented by `scripts/ci/agent-communication.mjs` and consumed by `scripts/ci/agent-session.mjs`.

Message states are:

`RECEIVED → READ → CONSUMED`

or fail-closed:

`RECEIVED → STALE`
`READ → BLOCKED_CONFLICT`

Receipt never grants execution authority. A message becomes execution-ready only after the target agent has read it, the message `entrySha` is current or explicitly revalidated, and the normal coordination ownership lock succeeds.

`messageId` and `idempotencyKey` identify one logical notification. Re-delivery is a NO-OP. Reuse of the same identity with different causal content is an idempotency collision and MUST fail closed.

Periodic supervision remains a recovery mechanism. It is not the primary communication path.

No agent may begin task selection, mutation or repair from a notification it has not consumed through the canonical communication path.

## Handoff integrity
Every delegation MUST contain:
`messageId + actor + intent + taskId + scope + entrySha + risk + dependencies + expectedEvidence + stopConditions + proofObligations`.

Every completion MUST return:
`status + exitSha + changedFiles + commands + evidenceRefs + remainingWork + openRcas + nextAction + decisionTrace + verificationState + ownershipState`.

Every agent session MUST also declare `taskId` and maintain a durable visibility record at `docs/agents/ledger/<sessionId>.json`. The record is OPEN while active and CLOSED only after logout records the final status and final summary. Other agents can read task, owner, scope, exact SHA lineage, evidence, unresolved work and final outcome from this ledger. It exposes coordination state without granting authority and never substitutes for certification.

Diagnosis-to-preparation handoffs additionally require the exact `failureFingerprint`, RCA evidence and falsification tests.

## Canonical v6 compatibility aliases
The following are machine-readable aliases retained for compatibility; they do not create additional protocols:
- **Agent login**
- **Central coordination control plane**
- **Ownership lock**
- **Action ledger**
- **Mandatory session handoff report**
- **Handoff**
- **Evidence and provenance**
- **Failure and RCA**
- **Conflict protocol**
- **Logout**
- `--from-session=<previous-session>`
- **Root-Cause-First Repair Protocol**
- **causal defect**
- **affected dependency/contract graph**
- **mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure**
- **symptom-only workaround**
- **new deterministic failure**

## Risk gates
### LOW
Bounded, reversible, non-protected change with deterministic verification.

### MEDIUM
Requires RCA, bounded diff, targeted regression, affected-contract verification and exact-SHA evidence.

### HIGH
Requires checkpoint, rollback plan, independent review and canonical certification evidence.

### CRITICAL
Autonomous mutation stops. Human authorization is required. Investigation and handoff evidence are preserved.

## Fresh-state and ownership rules
Before mutation, register an agent session. Every active session declares:
`RCA + file scope + contract scope + execution surface + dependencies + entry SHA`.

One mutable scope has one active owner. **Shared contracts, package manifests, CI workflows, protocol registries and certification surfaces have one owner by default: the Executive Controller.** If `main` moves, all downstream packets become stale until revalidated.

**LOCK_SCOPE** is the explicit lifecycle checkpoint that establishes this ownership before any mutation or execution packet is applied.

## Integration gate
The Executive Controller MUST reject a Task Agent packet when:
- baseline SHA is stale;
- task dependencies are unresolved;
- Error Agent RCA conflicts with repository evidence;
- prepared changes exceed declared scope;
- proof obligations are missing;
- a required contract owner was bypassed;
- required Scout evidence has not been consumed and recorded.

When Task Agent and Error Agent disagree, neither wins by priority. The controller freezes mutation, compares exact evidence/SHAs, requests a falsification check or fresh inspection, records the decision trace, then issues one authoritative execution packet.

## Standard lifecycle
`DISCOVER → LOCK_SCOPE → SCOUT → ERROR_DETECT/DIAGNOSE → TASK_UNDERSTAND → RCA/INSPECT → PLAN → RISK_GATE → PREPARE → INTEGRATION_REVIEW → EXECUTE → APPLY → TARGETED_VERIFY → AFFECTED_CONTRACT_VERIFY → INDEPENDENT_REVIEW → REGRESSION → RECURRENCE_CHECK → LEARN → PREVENT → CERTIFY → HANDOFF_OR_CLOSE`

Stages not applicable must be explicitly recorded as `NOT_APPLICABLE` with rationale. Required gates may never be silently skipped.

## Root-Cause-First repair
Every persistent repair records:
`trigger → propagation path → violated invariant → responsible source → observable symptom`.

A symptom-only workaround is not a repair. Neither is weakening assertions, suppressing errors, broad allowlisting, deterministic retry masking, deleting coverage, changing test ownership to evade failure, or moving the defect to another layer.

Closure requires:
`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → recurrence prevented → fresh exact-SHA evidence`.

## Parallelism and efficiency
Parallel work is allowed only for disjoint read/write scopes with explicit locks and the same authoritative baseline. Shared governance/CI/manifest files are serialized. Duplicate investigations are consolidated by fingerprint only after evidence equivalence is proven.

Efficiency means reducing repeated diagnosis, rework, duplicate scans and false-green risk while preserving every required gate.

## Learning protocol
Every meaningful failure produces:
`fingerprint + evidence + RCA + attempted strategy + result + prevention rule + provenance`.

Verified fixes become lessons/playbooks. Failed or blocked strategies become anti-lessons. Learning never grants authority and never silently changes contracts.

## Recovery and bounded attempts
Every mutation has a bounded attempt budget and recovery path. Failed repair is rolled back where safe; otherwise it is escalated with precise unresolved state. Infinite retry loops are forbidden.

## Certification separation
Agents produce evidence. Only the canonical certification system can issue final repository certification.

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, `MALFORMED_EVIDENCE`, stale evidence and unknown root causes are non-success states.

## Protocol hierarchy
`docs/PROTOCOL-REGISTRY.json` remains the single protocol inventory. This v7 orchestration is an extension of P20; it does not create a competing protocol.

## Enforcement
CI MUST verify the cooperation contract, Task Agent preparation-only boundary, Error Agent diagnosis-only boundary, coordination control plane, session/handoff schema, repair-proof controls and exact-SHA evidence rules.

Removing, bypassing, weakening, duplicating or silently ignoring these controls MUST fail the repository contract gate.
