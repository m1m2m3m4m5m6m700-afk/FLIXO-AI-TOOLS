# SUPREME UNIVERSAL AGENT EXECUTION PROTOCOL — P00

P00 is the first obligation of the FLIXO repository, project and shared cell. Every Master, Agent and Bot MUST consume docs/agents/PROMPT-UNIFIED-EXECUTION.md v4.0.0 before execution. All collaboration, handoff, repair, verification and continuity rules are subordinate to P00 and must not fork or weaken it.

Entry:
P00 ADMISSION → SESSION → EXACT SHA → CONTROL PLANE → SCOPE/OWNERSHIP → EXECUTION → EVIDENCE → CONTINUE.

P00 is enforced through the protocol registry, coordination/session validators, liveness controls and hard exit lock. Unresolved work is non-terminal.

## Absolute No-New-Branch Rule

The FLIXO agent team operates on exactly two active branch refs: `execution` and `main`. The topology is fixed:

`execution → main`

No agent may create, checkout, use, rename, or resurrect a third working branch for any reason, including feature work, conflict resolution, prompt work, repair attempts, per-error isolation, temporary staging, experiments, backups, or handoffs. A new failure is an in-flight failure on the same `execution` lane. Repair it there and continue the same controlled lifecycle.

Required behavior:
1. Verify the active branch is `execution` before mutation.
2. If a branch other than `execution` or `main` is proposed, stop and fail closed.
3. Use the existing `execution → main` integration PR for promotion.
4. Never solve a conflict by creating a third branch.
5. Historical branches are evidence only; they are not active work surfaces.

`BRANCH_CREATION_ATTEMPT` is a protocol violation requiring immediate controller review.

# FLIXO Multi-Agent Collaboration Protocol v7

## Mission
This protocol defines the operating system for the FLIXO agent team. The executive controller coordinates two primary runtime agents: **Task Agent** (preparation/implementation intelligence) and **Error Agent** (failure detection, diagnosis and root-cause intelligence). Supporting roles remain logical review/test/security/performance/certification functions and are invoked by risk and scope, not as uncontrolled independent writers.

Cooperation never weakens repository policy, certification or human authority.


## Unified Agent Commands & Protocol Surface

هذا القسم هو **فهرس تشغيلي موحّد** للقواعد والأوامر الموجودة في البروتوكولات المعتمدة. لا ينشئ Protocol أو Registry أو Certification Authority جديدة؛ عند التعارض تُطبّق أولوية docs/PROTOCOL-HIERARCHY.md والـmachine-readable validators.

### Authority chain

Protocol → Validator → Evidence → Certification

Prompt = execution instruction فقط ولا يمنح صلاحية.
Protocol = السلطة التنفيذية.
Validator = إنفاذ البروتوكول.
Evidence = الإثبات.
Certification Authority = جهة الإغلاق النهائي.

Prompt أو Memory أو Handoff أو Scout report أو Historical lesson لا تمنح mutation أو certification authority من تلقاء نفسها.

### Mandatory entry gate

قبل أي تنفيذ أو mutation، اقرأ بالترتيب:

PROJECTS.md
↓
المهام.md
↓
AGENTS.md
↓
docs/EXECUTION-BRANCH-PROTOCOL.md
↓
docs/AGENT-COLLABORATION-PROTOCOL.md
↓
docs/AGENT-HANDOFF-REPORT-SCHEMA.md
↓
docs/AGENT-COORDINATION-CONTROL-PLANE.md
↓
docs/PROTOCOL-HIERARCHY.md
↓
docs/PROTOCOL-REGISTRY.json
↓
docs/agents/PROMPT-REGISTRY.json
↓
diagnostics/auto-repair/memory.json
↓
docs/MINIMAL-CI-FINAL-ARCHITECTURE.md
↓
scripts/ci/test-plan.json
↓
scripts/ci/assertion-registry.json
↓
current exact SHA + current workflow state

أي mutation قبل اكتمال بوابة الدخول = FAIL_CLOSED.

### Standard lifecycle

DISCOVER
→ READ_INBOX
→ INGEST_HANDOFF
→ REVALIDATE_EXACT_SHA
→ LOCK_SCOPE
→ TASK_CLAIM
→ SCOUT
→ ERROR_DETECT / DIAGNOSE
→ TASK_UNDERSTAND
→ RCA / INSPECT
→ PLAN
→ RISK_GATE
→ PREPARE
→ INTEGRATION_REVIEW
→ EXECUTE
→ APPLY
→ TARGETED_VERIFY
→ AFFECTED_CONTRACT_VERIFY
→ INDEPENDENT_REVIEW
→ REGRESSION
→ RECURRENCE_CHECK
→ LEARN
→ PREVENT
→ CERTIFY
→ HANDOFF_OR_CLOSE

### Repair lifecycle

RED
→ CAPTURE exact SHA + run/job/step/evidence
→ FAILURE FINGERPRINT
→ bind repairChainId
→ RCA
→ prove trigger → propagation → violated invariant → causal source → symptom
→ FALSIFY / REPRODUCE
→ PRE-MUTATION PROOF
→ RISK_GATE
→ REPAIR causal source on execution
→ TARGETED_REGRESSION
→ AFFECTED_CONTRACT_VERIFY
→ FULL_REQUIRED_VERIFICATION
→ EXACT_SHA_CHECK
→ LEARN / PREVENT
→ HANDOFF / CERTIFICATION

Patch-to-green وحده لا يثبت الإصلاح.

### Administrative attendance and missed-attendance inquiry

**رسائل الإدارة = Canonical Agent Communication.** الاستدعاء الإداري لأي Master أو Agent أو Bot هو `P0 / IMMEDIATE` ويحتاج حضورًا وإقرارًا صريحًا: `RECEIVED → READ → UNDERSTOOD → ACCEPTED`. عند انتهاء نافذة الحضور دون الإقرار يُسجّل `MISSED_P0_ATTENDANCE` وتُنشأ رسالة `ADMIN_ATTENDANCE_INQUIRY` لنفس المستلم، ولا يُغلق الاستدعاء قبل معالجة الاستفسار.

`node scripts/ci/agent-communication.mjs audit-attendance --message-id=<id>`

### Council meeting exit lock

الجلسة المنشأة بـ`meetingId` لا تسمح بـ`logout` الذاتي. المسار الوحيد لفتح الخروج هو موافقة `assistantController` عبر `meeting-exit-approve` على نفس الجلسة والاجتماع وExact-SHA.

### Session and visibility commands

بدء الجلسة:
node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --role=<role> --task=<task-id>

الاستمرار:
node scripts/ci/agent-session.mjs login --session=<new-id> --agent=<id> --role=<role> --task=<task-id> --from-session=<previous-session>

الاستمرار يتطلب predecessor handoff موجودًا ومغلقًا و exitSha == current SHA ونفس taskId.

الأحداث:
node scripts/ci/agent-session.mjs event --session=<id> --agent=<id> --task=<task-id> --type=<TYPE> --summary="<what happened>"

استقبال:
node scripts/ci/agent-session.mjs message-receive --session=<id> --agent=<id> --task=<task-id> --message-id=<id>

استهلاك:
node scripts/ci/agent-session.mjs message-consume --session=<id> --agent=<id> --task=<task-id> --message-id=<id>

الإغلاق:
node scripts/ci/agent-session.mjs logout --session=<id> --agent=<id> --status=VERIFIED --final-summary="<final-outcome>"

VERIFIED محظور مع failedWork أو remainingWork أو openRcas. ينتج handoff في diagnostics/agents/handoffs/<sessionId>.json وسجل visibility في docs/agents/ledger/<sessionId>.json.

### Administrative Messages — Canonical Alias

**رسائل الإدارة = Canonical Agent Communication.** This is the single internal communication system between the Council, Masters, supervisors, agents, and supporting roles. The Arabic term is an alias only; it MUST NOT create or imply a second transport, protocol, registry, inbox, or authority surface.

When a message is described as **رسالة إدارية / رسائل الإدارة**, process it through the existing canonical communication commands and lifecycle. Council administrative messages retain **P0 / IMMEDIATE** priority.

### Canonical agent communication

الأوامر:
node scripts/ci/agent-communication.mjs validate
node scripts/ci/agent-communication.mjs ingest
node scripts/ci/agent-communication.mjs read
node scripts/ci/agent-communication.mjs ack

المسار:
NOTIFICATION → MASTER INBOX → EVENT-DRIVEN RELAY → READ → EXACT-SHA REVALIDATION → OWNERSHIP / DEPENDENCY CHECK → EXECUTE

Duplicate message = NO-OP. Idempotency collision = FAIL_CLOSED.

### Task ownership and coordination

node scripts/ci/agent-coordination.mjs task-create
node scripts/ci/agent-coordination.mjs task-claim
node scripts/ci/agent-coordination.mjs task-release
node scripts/ci/agent-coordination.mjs task-complete
node scripts/ci/agent-coordination.mjs task-next
node scripts/ci/agent-coordination.mjs state
node scripts/ci/agent-coordination.mjs brief
node scripts/ci/agent-coordination.mjs visible
node scripts/ci/agent-coordination.mjs ingest-handoff

المبدأ: one mutable scope → one owner. التوازي مسموح فقط للـdisjoint scopes مع dependency barriers.

### Liveness and wake

الجلسة المفتوحة لا تصبح SLEEP أو IDLE أو SILENT أو ABANDONED.

عند انتظار CI أو provider خارجي:
WAITING_EXTERNAL + heartbeat

الأمر:
node scripts/ci/repair-lease.mjs heartbeat ...

عند stale heartbeat/lease:
RECOVERING → supervisor / wake path

Wake الإصلاح يحمل exact execution SHA + failure fingerprint + run/workflow + classification + RCA hint + work package + targeted-test policy + learning requirements. Duplicate wake لنفس SHA + fingerprint يتم suppress.

### Pre-mutation proof

قبل source mutation:
failure reproduced
+
causal mechanism supported
+
repair simulation / proof
+
scope allowed
+
SHA current
+
mutation gate PASS

ثم فقط:
pre-mutation proof → mutation gate → mutation

### Memory and prompt intelligence

Error Memory = diagnostics/auto-repair/memory.json

الذاكرة Advisory فقط:
SUCCESS → lesson
FAILURE → anti-lesson
BLOCKED_EXTERNAL → external anti-lesson
REVERTED → strategy rejection
PROPOSED → لا يزيد الثقة

قبل إنشاء أو تعديل Prompt:
READ PROMPT REGISTRY → SEARCH FINGERPRINT → SEARCH RCA → SEARCH LESSONS / ANTI-LESSONS → CHECK OVERLAP / CONFLICT → REUSE / EXTEND / MERGE / SPECIALIZE

أي duplicate أو overlap أو conflict غير محلول = PROMPT_REVIEW_REQUIRED.

### Authority separation

Task Agent = preparation / bounded task ownership
Error Agent = diagnosis
Repair Agent = authorized mutation
Execution Agent = authorized mutation
Review Agent = independent review
Test Agent = testing / verification
Security Agent = security verification
Performance Agent = performance verification
Code Scout = read-only scouting
Certification Authority = certification / closure

Task Agent ≠ mutation.
Error Agent ≠ mutation.
Memory ≠ authority.
Prompt ≠ authority.
Scout ≠ write.
Certification ≠ repair.

### Evidence and exact-SHA

كل action مادي يحافظ على:
actor + intent + entrySha + exitSha + changedFiles + commands + result + evidenceRefs + nextState

أي repository movement يجعل الأدلة السابقة stale.
لا توجد verified أو green أو repaired أو certified أو closed بدون exact current SHA.

### Canonical verification

بحسب السياق، تشمل بوابة الفحص الأساسية:
npm ci --prefer-offline --no-audit --no-fund
npm run typecheck
npm run lint
npm run test:unit
npm run test:static
npm run test:build
npm run validate:ci-contract
npm run validate:agent-protocol
npm run validate:agent-coordination
npm run validate:contracts
npm run validate:i18n
npm run validate:tool-registry
npm run verify:ci-cd-trust

الـtargeted regression يسبق full required verification. أي push جديد يسقط صلاحية الأدلة الأقدم ويجعل أحدث branch head وحده مصدر test evidence. ممنوع تصنيع GREEN عبر حذف أو تخطي أو إضعاف الاختبارات أو gates.

### External blocker and same-cycle

السبب الخارجي = BLOCKED_EXTERNAL مع حفظ evidence وprovider signature والتعلم. لا يتحول إلى source workaround لإخفاء العائق.

RED جديد داخل repair cycle لا ينشئ branch أو lane أو cycle موازية:
same repairChainId → capture RED → fingerprint → RCA → correction → hardening → regression → rescan

### Closure

الإغلاق النهائي فقط مع:
Canonical CI = GREEN
AND exact execution SHA verified
AND zero required RED
AND fresh evidence
AND no open RCA
AND no remainingWork
AND no failedWork
AND regression passed
AND prevention proved
AND certification passed

بعدها:
execution → main → fresh verification on main

### Council

مصدر الدخول التشغيلي الحالي هو PR #759. Issue #761 ليس activation source.
التخطيط عبر scripts/ci/council-wake-dispatch.mjs والـrelay عبر .github/workflows/agent-communication-relay.yml.

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

## Immutable Two-Branch Repository Invariant

The repository topology is permanently limited to:

`execution → main`

**No new branch may be created under any circumstance.** This prohibition applies to every agent, automation, workflow, recovery path, test path, handoff path, and human-requested shortcut.

A proposed feature/fix/chore/repair/agent/test/temp/backup/experimental/hotfix/third branch is a hard integrity violation. Stop before creation, preserve evidence, remain on `execution`, and continue through the existing canonical lane.

Branch topology must be treated as a protected control-plane invariant and revalidated before mutation and promotion. A third-branch request must resolve to `FAIL-CLOSED`, never to branch creation.

## Shared Prompt Intelligence Protocol

The repository has one canonical Prompt Registry at `docs/agents/PROMPT-REGISTRY.json`. It is a shared coordination artifact, not a source of authority. Prompt text cannot override `scripts/ci/repair-protocol.mjs`, validators, exact-SHA evidence, security controls, or canonical certification.

Before creating, extending, merging, specializing, splitting, deprecating, or selecting a repair prompt, the agent MUST:
1. read the Prompt Registry;
2. search the current failure fingerprint;
3. search the current RCA and similar causal families;
4. read Error Memory lessons and anti-lessons;
5. compare existing prompts by causal fields rather than wording;
6. check overlap and conflict;
7. reuse, extend, merge, or specialize before creating a new prompt.

The canonical comparison key is:
`failureClasses + rootCauses + scope + repairStrategy + verificationPlan`.

Every prompt selection MUST be bound to the current target SHA and recorded with prompt ID, version, registry digest, decision, and provenance. Prompt quality failure returns `PROMPT_REVIEW_REQUIRED` and MUST NOT activate the prompt.

After each repair attempt the learning record SHOULD preserve the prompt used, outcome, verification state, changed files, exact SHA, lesson/anti-lesson decision, and provenance. SUCCESS produces lesson evidence; FAILURE produces anti-lesson evidence; REVERTED produces strategy-rejection evidence; PROPOSED and BLOCKED_EXTERNAL do not increase internal repair confidence.

`RPR-UNIFIED-EXECUTION-001` is the sole active canonical FLIXO prompt. Historical specialist prompt families are absorbed/retired and MUST NOT create a competing policy, control plane, registry, certification authority, or customer-runtime prompt source. The customer runtime adapter imports this same canonical source and supplies only dynamic runtime context.

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

## Mutation authority invariant

`Task Agent = preparation only` is an enforced authority boundary, not a prompt preference.

`repairAgent` and `executionAgent` are the authorized repair mutation roles. A Task Agent packet can describe a source change, but it cannot apply, commit, push, merge or certify it.

`scripts/ci/repair-protocol.mjs` is the machine-enforced mutation authority. Any attempt to add `taskAgent` to `mutationAgents` is a contract violation and is covered by the repair-protocol regression.

Prompt text, memory, handoff content and Task Agent output cannot grant authority that the machine control plane does not grant.

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

## Direct CELL → MASTER communication invariant

Every registered CELL-\d{3} agent has a direct communication path to assistantController through the canonical scripts/ci/agent-communication.mjs inbox.

The direct channel accepts mission requests, evidence packets, RCA escalation, conflict notices and Master-repair requests. It does not grant mutation, certification, promotion or permission authority.

Required envelope:
`messageId + idempotencyKey + actor(CELL-xxx) + recipient(assistantController) + taskId + entrySha + risk + scope + expectedEvidence + stopConditions + proofObligations`.

A CELL agent may request Master intervention when:
- no safe repair exists in its available knowledge;
- the historical index has no applicable verified strategy;
- independent results conflict;
- scope or authority is ambiguous;
- a new root cause requires a new repair plan.

The Master receives the request, revalidates the exact SHA, decides the next mission, and returns the result through the same canonical inbox. Any new verified repair knowledge is then eligible for normal Knowledge Engine/index learning.

The channel never becomes an alternate mutation or certification path.

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

The canonical ingress is the active Council conversation at canonical PR #759. Issue #761 is archived and rejected as an activation source. The event-driven adapter is `.github/workflows/agent-communication-relay.yml`, and the President Wake dispatcher is integrated into `.github/workflows/agent-communication-relay.yml`, using `scripts/ci/council-wake-dispatch.mjs` as the deterministic planner. The machine-readable inbox lifecycle is implemented by `scripts/ci/agent-communication.mjs` and consumed by `scripts/ci/agent-session.mjs`.

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

Every completed repair/verification cycle MUST emit `cycleLessons` before handoff/transition. The list records the RCA lesson, strategy lesson or anti-lesson, verification lesson, bounded scope when relevant, recurrence/prevention rule, and external-blocker anti-lesson when relevant. `cycleLessons` is continuity/learning evidence only and is never certification or mutation authority.

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


## Assistant Repair Fallback — P20
When both `repairAgent` and `executionAgent` are unavailable, `assistantRepairAgent` may execute a learned repair directly on `execution`. It must use a previously verified repair rule from the canonical memory with at least 0.90 success confidence and support from at least two successful fingerprints. The rule is revalidated against the current exact SHA and must remain inside the normal Repair Protocol. No new speculative strategy, gate bypass, third branch, or certification self-approval is permitted. If any fallback condition is not proven, execution fails closed.


## Presidential Council hierarchy and large Work Packages

`PRESIDENT → DEPUTY → INVESTIGATOR`

P20 remains the single cooperation protocol; this section extends it without creating a competing protocol.

- Council President = `assistantController`: mission selection, priority, assignment, arbitration, handoff acceptance and closure decisions. No mutation or certification.
- Council Deputy = `verification`: queue sequencing, dependency ordering, ownership conflicts, session visibility and handoff flow. No mutation or certification.
- Council Investigator = `analysis`: fingerprint, RCA, propagation, causal source, falsification and proof obligations. No mutation or reassignment.

Every executable task is a causally coherent large Work Package carrying `missionId, workPackageId, taskId, councilRole, ownerRole, ownerAgent, workItems, acceptanceCriteria, proofObligations, dependsOn, entrySha, handoffTo`. Independent causes remain separate tasks.

Claim admission fails closed when ownerRole is missing/mismatched, when the agent is not the assigned owner, when required Work Package fields are missing, or when the session scope does not cover the task scope. Unassigned ledger tasks return to the President as PENDING_ASSIGNMENT.

Wake lifecycle: `PRESIDENT WAKE → exact-SHA validation → role/work-package validation → canonical communication relay → reusable workflow dispatch OR external-agent wake → session → claim → execute → handoff → President decision`. Wake never grants mutation authority.


## External GPT account runtime

P20 now carries a transport layer for exactly three external account identities: `CHIEF`, `WORKER_A`, `WORKER_B`.

The runtime chain is `GitHub RED → CHIEF → WORKER_A/B → ACK + lease → heartbeat → completion → HANDOFF_READY → CHIEF`. Only CHIEF may dispatch worker packages.

Lease expiry transfers a worker package to its configured counterpart exactly once. A second expiry remains unresolved and is returned to CHIEF; retry recursion is bounded.

Persistence is server-side in Supabase. GitHub Actions supplies the automatic RED trigger and one-minute lease recovery watcher. External workers may use push endpoints or polling.

A normal ChatGPT UI session is not directly addressable by GitHub. The final account-to-account connection therefore requires an external GPT runtime bridge or poller controlled by the corresponding account/operator. Secrets remain server-side.


## Action Vault — P20 resident repair triad

The Action Vault is an extension of P20, not a second protocol. Its three permanent residents have deliberately separated duties:

- `ACTION-REPAIR` (`actionRepairBot`) is the only Action Vault mutation role. It may repair only on `execution`, after Repair Protocol admission, exact-SHA binding, ownership lock, causal diagnosis and bounded proof obligations.
- `ACTION-REPAIR-2` (`actionRepairVerifier`) is an independent adversarial verifier. It challenges the RCA, tests alternative hypotheses, checks changed-scope legitimacy and validates post-repair evidence. It has no mutation or certification authority.
- `ACTION-HISTORIAN-3` (`actionHistorian`) is the learning/recurrence specialist. It records lessons, anti-lessons, rejected strategies and prevention rules from exact-SHA evidence. It has no mutation or authority-granting power.

A shared Action Vault mission requires `triadId`, `messageId`, `taskId`, failure fingerprint, entry/target SHA, owner, proof obligations and stop conditions. Blind retries are forbidden. Three identical cycles without verifiable progress open escalation and preserve the anti-lesson.

A reusable repair rule is not promoted from one success: the memory promotion gate requires at least two independently verified successful exact-SHA cases plus an explicit prevention rule. The Action Vault can preserve continuity through escalation, but escalation is never closure; only canonical GREEN can close the repair cycle.

<!-- ACTION_VAULT_CANONICAL_PROTOCOL_START -->
# ACTION VAULT — CANONICAL BOT PROTOCOL v1

**Protocol ID:** ACTION-VAULT-CANONICAL-BOT-PROTOCOL-v1
**MASTER COPY:** `docs/AGENT-COLLABORATION-PROTOCOL.md`
**MIRRORS:** Action Vault protocol file + each resident bot work file
**RULE:** Every mirror must be byte-for-byte identical to this canonical block. A mismatch is a fail-closed protocol violation.

## Mission
The Action Vault is the intensive repair environment for `ACTION-REPAIR`, `ACTION-REPAIR-2`, and `ACTION-HISTORIAN-3`.

Canonical knowledge index:
`diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`

The current index is the existing teaching mirror and may grow toward the declared 1,000,000-record capacity. The canonical path and identity are preserved.

## Mandatory reading
Before analysis, repair, knowledge write/edit, escalation, handoff, or closure, every Vault bot MUST read this protocol from its own mirror and verify that the mirror is identical to the MASTER COPY.

Required lifecycle:
`MASTER COPY` → `BOT MIRROR READ` → `EXACT SHA` → `FAILURE IDENTITY` → `INDEX SEARCH` → `TRIAD REVIEW` → `REPAIR OR ESCALATE`

Missing or mismatched protocol = FAIL CLOSED.

## Bot authority
All three resident bots have intensive repair authority within the bounded Vault scope.

`ACTION-REPAIR`: constructive programmer; may add/edit repair knowledge; may become the single active source-repair owner after admission.

`ACTION-REPAIR-2`: adversarial programmer; may add/edit repair knowledge; must challenge the primary diagnosis and search for counterexamples; may become the single active source-repair owner after admission.

`ACTION-HISTORIAN-3`: master knowledge/index custodian and diagnosis-to-knowledge judge; may ADD and EDIT the canonical Action Vault index; records every RED, attempt, repaired outcome and unresolved failure; decides whether programming diagnosis matches textual knowledge; may become the single active source-repair owner after admission.

No Vault bot may mutate `main`, mutate tests for repair purposes, weaken gates, delete historical knowledge, or declare Canonical GREEN.

Only one source-mutation owner may exist for an active task.

## Canonical index custody
Owner: `ACTION-HISTORIAN-3`
Path: `diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`

ADD = ALLOWED
EDIT = ALLOWED
DELETE = FORBIDDEN

Every index record must preserve:
`taskId + failureFingerprint + targetSha + failedRunId + sourceBot + evidence/provenance`.

The index is knowledge storage, not execution authority or GREEN authority.

## Mandatory learning
Every actionable RED is recorded.
Every repair attempt is recorded.
Every verified repair is recorded.
Every unresolved failure is recorded and escalated.
No failed attempt may disappear from the learning chain.

## Unresolved failure → Council
When the triad cannot prove a correction, `ACTION-HISTORIAN-3` must:

1. record the unresolved failure in the canonical index;
2. preserve exact SHA, failure fingerprint, run identity and attempted strategy;
3. create the canonical Council escalation;
4. deliver it to `assistantController`;
5. request a specialist supervisor lesson;
6. receive a structured teaching lesson;
7. validate lesson provenance against the exact case;
8. write the lesson back to the same canonical index;
9. expose the lesson to all three Vault bots for the next repair cycle.

Canonical route:
`ACTION-HISTORIAN-3` → `assistantController` → active Council ingress → specialist supervisor → structured lesson → `ACTION-HISTORIAN-3` → `ACTION-INDEX-4000` → next exact-SHA attempt.

Required escalation fields:
`messageId, taskId, failureFingerprint, entrySha, failedRunId, actor=ACTION-HISTORIAN-3, recipient=assistantController, intent=ACTION_VAULT_KNOWLEDGE_ESCALATION, risk=HIGH, requestedAction=SPECIALIST_TEACHING, knowledgeIndex=diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json, workPackage=ACTION-VAULT-SUPERVISOR-TEACHING-001, role=REVIEW, relayMarker=<!-- FLIXO_AGENT_COUNCIL_WAKE -->`.

Stale or malformed messages fail closed.

## Supervisor teaching
Supervisor lessons must include:
`supervisorRole + taskId + failureFingerprint + targetSha + rootCause + knowledgePrinciple + repairPattern + verificationCondition + antiLesson + sourceMessageId + evidenceRefs`.

The returned lesson is written into the same Action Vault index as `SUPERVISOR_TAUGHT`.

The lesson is provisional until the resulting repair reaches Canonical GREEN; GREEN is the authority for verified reusable learning.

## Diagnosis ↔ textual knowledge gate
Before source mutation, `ACTION-HISTORIAN-3` compares the programming diagnosis against retrieved textual knowledge.

Decision:
`MATCH` | `MISMATCH` | `INCONCLUSIVE`

`MATCH` allows the mutation gate to continue.
`MISMATCH` blocks source mutation.
`INCONCLUSIVE` blocks source mutation.

The decision is bound to task, fingerprint, run identity, exact SHA, diagnosis digest and catalog digest.

## Triad proof
Every actionable RED requires all three contributions.

`ACTION-HISTORIAN-3` records the failure, selects minimal file surface and judges diagnosis ↔ knowledge.

`ACTION-REPAIR` constructs the root-cause and repair proof.

`ACTION-REPAIR-2` independently attempts to falsify the primary diagnosis/repair and records counterexamples.

A valid counterexample blocks mutation.

No counterexample is not GREEN.

## Source mutation gate
Source repair is permitted only on `execution`, only within declared error scope, and only after:
protocol read → exact-SHA validation → failure capture → index search → triad contributions → bot-3 MATCH → root-cause proof → adversarial falsification → sandbox → differential verification → targeted regression → single-owner admission.

A new push invalidates old exact-SHA evidence.

## Resident bot commands

Protocol read:
```bash
node scripts/ci/action-vault-knowledge-custodian.mjs assert-read --bot=<BOT_ID> --sha="$(git rev-parse HEAD)"
```

Record verified repair:
```bash
node scripts/ci/action-vault-knowledge-custodian.mjs record-repair --task=<TASK_ID> --fingerprint=<FAILURE_FINGERPRINT> --sha=<EXACT_SHA> --run-id=<RUN_ID> --diagnosis-file=<DIAGNOSIS_JSON> --repair-summary="<REPAIR_SUMMARY>" --evidence=<REF1,REF2>
```

Record unresolved failure and escalate:
```bash
node scripts/ci/action-vault-knowledge-custodian.mjs record-blocked --task=<TASK_ID> --fingerprint=<FAILURE_FINGERPRINT> --sha=<EXACT_SHA> --run-id=<RUN_ID> --error="<ERROR>" --diagnosis="<DIAGNOSIS_OR_UNKNOWN>" --strategy="<STRATEGY>"
```

Edit index:
```bash
node scripts/ci/action-vault-knowledge-custodian.mjs edit-index --task=<TASK_ID> --fingerprint=<FAILURE_FINGERPRINT> --run-id=<RUN_ID> --sha=<EXACT_SHA> --record-id=<TXXXX> --patch-json='{"teaching":"...","verify":"..."}'
```

Apply supervisor teaching:
```bash
node scripts/ci/action-vault-knowledge-custodian.mjs apply-supervisor-lesson --task=<TASK_ID> --fingerprint=<FAILURE_FINGERPRINT> --sha=<EXACT_SHA> --run-id=<RUN_ID> --lesson-file=<LESSON_JSON>
```

## Hard stops
Stop immediately on protocol mismatch, missing read, stale SHA, missing triad contribution, diagnosis MISMATCH/INCONCLUSIVE, valid counterexample, unproven root cause, unsafe scope, gate weakening, test/main mutation, index deletion, missing provenance, or missing canonical verification.

Preserve evidence and continue through the Council/specialist learning path. Do not silently close the task.

## Master/mirror rule
The single source of truth is the canonical block between:
`ACTION_VAULT_CANONICAL_PROTOCOL_START` and `ACTION_VAULT_CANONICAL_PROTOCOL_END`
inside `docs/AGENT-COLLABORATION-PROTOCOL.md`.

Exact copies are required in:
- `diagnostics/auto-repair/action-vault/ACTION-VAULT-SUPERVISORY-LEARNING-PROTOCOL.md`
- `diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR.json`
- `diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR-2.json`
- `diagnostics/auto-repair/action-repair-bots/ACTION-HISTORIAN-3.json`

No resident bot may invent, shorten, fork, or override this protocol.

<!-- ACTION_VAULT_CANONICAL_PROTOCOL_END -->

## CELL-LAB — SHARED ENGINEERING LAB

The FLIXO cell is the full communication and decision laboratory for the Masters, Agents and Bots. P00 is admitted first; P20 then requires the Cell-Lab collaboration cycle for every material execution decision.

### Cell-Lab lifecycle

`OPEN → DISCUSS → QUESTION → CHALLENGE → RESOLVE → SYNTHESIZE → CONSENSUS → EXECUTE → VERIFY → LEARN`

The laboratory is the canonical place to exchange:
`OPINION | QUESTION | CHALLENGE | DECISION`.

Every material task must expose its discussion to the applicable Masters and execution participants through the Canonical Agent Communication path. Replies, objections, evidence and resolution are retained. A single integrated plan is produced only after the required participants agree.

### Consensus gate

The canonical packet is:
`diagnostics/agents/cell-lab/consensus/<taskId>.json`

It must be bound to:
`taskId + exactSha + objective + integratedPlan + planHash + participants + discussions + dissentResolved + proofObligations + stopConditions`.

Required core participants:
`MASTER-1 + MASTER-2 + MASTER-3`, plus the mutation owner.

A packet is execution-ready only when:
`status=AGREED + executionReady=true + discussionClosed=true + no remaining questions + no unresolved conflicts + every final DECISION is AGREED`.

Consensus does not grant mutation, merge or certification authority. It creates the shared plan and proves that the relevant cell participants discussed and resolved the decision before execution.

### No silent bypass

No agent may privately decide a material source mutation when the Cell-Lab gate is required. A conflicting opinion is not discarded; it becomes a documented dissent and must be resolved or preserved as an explicit accepted risk. Stale SHA invalidates the packet.

Machine enforcement:
`scripts/ci/cell-lab-consensus.mjs → scripts/ci/repair-protocol.mjs → mutation admission`.

