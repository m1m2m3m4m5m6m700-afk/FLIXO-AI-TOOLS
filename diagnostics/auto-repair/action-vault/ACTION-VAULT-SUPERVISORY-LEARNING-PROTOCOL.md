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
