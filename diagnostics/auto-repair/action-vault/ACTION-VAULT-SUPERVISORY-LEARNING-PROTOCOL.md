# ACTION VAULT — SUPERVISORY LEARNING PROTOCOL v1

Status: MANDATORY / CANONICAL WITHIN ACTION VAULT  
Protocol ID: ACTION-VAULT-SUPERVISORY-LEARNING-v1  
Residence: diagnostics/auto-repair/action-vault/  
Authority boundary: This protocol governs Action Vault knowledge handling and supervision. It does not replace Canonical CI and it cannot grant GREEN.

## 1. Purpose

The Action Vault is a resident repair environment for three collaborating bots:

- ACTION-REPAIR
- ACTION-REPAIR-2
- ACTION-HISTORIAN-3

The Action Vault index is:

`diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`

The current file is a 4,000-record teaching mirror and is allowed to grow toward the declared one-million-record knowledge capacity. The filename is retained as the canonical Action Vault path; the numeric baseline is not a hard record-count ceiling.

ACTION-HISTORIAN-3 is the custodian of this index. It has explicit permission to ADD and EDIT index records. Deletion is forbidden. Every write is bound to the current exact SHA, task identity, failure fingerprint, failed run ID, and provenance.

## 2. Mandatory read rule

Reading this file is the first Action Vault operation.

No bot may:

- inspect a RED and begin repair,
- propose or edit source,
- add or edit knowledge,
- mark a failure,
- escalate to the Council,
- receive a supervisor lesson,
- close a mission,

until this protocol has been read and its mandatory-read check passes against the current exact SHA.

The read is enforced by:

`scripts/ci/action-vault-knowledge-custodian.mjs assert-read`

and by the Action Vault agent gate.

## 3. Role of ACTION-HISTORIAN-3

ACTION-HISTORIAN-3 has two supervisory responsibilities.

First: knowledge custody. It may add and edit the Action Vault index, record verified repairs, record unresolved failures, preserve rejected approaches, and attach exact provenance.

Second: diagnosis-to-knowledge adjudication. It determines whether the programming diagnosis is compatible with the textual knowledge retrieved from the index. `MATCH` permits the repair gate to continue; `MISMATCH` and `INCONCLUSIVE` block source mutation.

ACTION-HISTORIAN-3 is not allowed to silently convert an unsupported diagnosis into truth. The evidence and the decision remain visible.

## 4. Every repair outcome becomes history

When a repair is verified by the canonical Green chain, ACTION-HISTORIAN-3 records:

- failure fingerprint and exact failure signal;
- diagnosed root cause;
- repaired file/scope;
- repair mechanism;
- targeted regression evidence;
- exact target SHA;
- Canonical GREEN record;
- lesson;
- prevention rule;
- source bots.

The outcome is appended to the same Action Vault index. An existing record may be EDITED only to correct or enrich its provenance; existing IDs are never deleted.

## 5. Every unresolved failure becomes a Council lesson request

A repair failure is never discarded.

When ACTION-HISTORIAN-3 determines that the active repair attempt remains unresolved, it MUST:

1. write an unresolved-failure record to the Action Vault index;
2. preserve the exact failure fingerprint and target SHA;
3. create a canonical Council escalation message;
4. deliver the message to `assistantController`;
5. activate the Council learning route;
6. request a specialist supervisor with relevant programming knowledge;
7. receive a structured teaching lesson;
8. validate the lesson against the exact SHA and the unresolved case;
9. append the new advice to the same Action Vault index;
10. expose the lesson to all three resident bots for the next attempt.

Failure escalation does not close the repair task. The mission remains OPEN until Canonical GREEN or an explicit external block.

## 6. Council message contract

Every unresolved failure message MUST contain:

`messageId`  
`taskId`  
`failureFingerprint`  
`entrySha`  
`failedRunId`  
`actor=ACTION-HISTORIAN-3`  
`recipient=assistantController`  
`intent=ACTION_VAULT_KNOWLEDGE_ESCALATION`  
`risk=HIGH`  
`requestedAction=SPECIALIST_TEACHING`  
`knowledgeIndex=diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`  
`relayMarker=<!-- FLIXO_AGENT_COUNCIL_WAKE -->`  
`workPackage=ACTION-VAULT-SUPERVISOR-TEACHING-001`  
`role=REVIEW`

The Council route is:

ACTION-HISTORIAN-3  
→ assistantController  
→ active Council ingress  
→ specialist supervisor  
→ structured lesson  
→ ACTION-HISTORIAN-3  
→ Action Vault index  
→ next repair cycle

The exact SHA is revalidated at every handoff. A stale message cannot authorize action.

## 7. Supervisor lesson contract

A supervisor lesson must identify:

- supervisor identity or role;
- the failure fingerprint;
- the exact SHA it was derived for;
- the root cause or corrected hypothesis;
- the relevant knowledge principle;
- the repair pattern;
- the verification condition;
- anti-lesson / strategy to avoid;
- source references;
- teaching timestamp.

The lesson is written into the Action Vault index as `SUPERVISOR_TAUGHT` with full provenance. It becomes canonical verified learning only after the Canonical Green chain confirms the resulting repair.

## 8. Knowledge write permissions

ACTION-HISTORIAN-3:

ADD = ALLOWED  
EDIT = ALLOWED  
DELETE = FORBIDDEN

Allowed path:

`diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json`

All writes:

- branch = `execution`;
- current HEAD must equal the provided target SHA;
- task/fingerprint/run identity must be present;
- old records remain intact;
- index capacity must not exceed 1,000,000 records;
- no test, main, control-plane, or gate weakening is permitted;
- every new or edited record carries provenance.

The index is mutable knowledge, not execution authority.

## 9. Commands — canonical bot commitment copy

Every resident bot uses the following commands from the repository root.

### A. Mandatory protocol read

```bash
node scripts/ci/action-vault-knowledge-custodian.mjs assert-read \
  --bot=ACTION-HISTORIAN-3 \
  --sha="$(git rev-parse HEAD)"
```

### B. Record a verified repair

```bash
node scripts/ci/action-vault-knowledge-custodian.mjs record-repair \
  --task=<TASK_ID> \
  --fingerprint=<FAILURE_FINGERPRINT> \
  --sha=<EXACT_SHA> \
  --run-id=<FAILED_RUN_ID> \
  --diagnosis-file=<PATH_TO_DIAGNOSIS_JSON> \
  --repair-summary="<REPAIR_SUMMARY>" \
  --evidence=<EVIDENCE_REF_1,EVIDENCE_REF_2>
```

### C. Record an unresolved failure and escalate

```bash
node scripts/ci/action-vault-knowledge-custodian.mjs record-blocked \
  --task=<TASK_ID> \
  --fingerprint=<FAILURE_FINGERPRINT> \
  --sha=<EXACT_SHA> \
  --run-id=<FAILED_RUN_ID> \
  --error="<ERROR_SUMMARY>" \
  --diagnosis="<DIAGNOSIS_OR_UNKNOWN>" \
  --strategy="<ATTEMPTED_STRATEGY>"
```

### D. Edit an existing knowledge record

```bash
node scripts/ci/action-vault-knowledge-custodian.mjs edit-index \
  --sha=<EXACT_SHA> \
  --record-id=<TXXXX> \
  --patch-json='{"teaching":"...","verify":"...","provenanceRef":"..."}'
```

### E. Apply a supervisor teaching lesson returned by the Council

```bash
node scripts/ci/action-vault-knowledge-custodian.mjs apply-supervisor-lesson \
  --task=<TASK_ID> \
  --fingerprint=<FAILURE_FINGERPRINT> \
  --sha=<EXACT_SHA> \
  --run-id=<FAILED_RUN_ID> \
  --lesson-file=<SUPERVISOR_LESSON_JSON>
```

### F. Required triad runtime admission

```bash
node scripts/ci/action-three-bot-collaboration.mjs start \
  --task=<TASK_ID> \
  --fingerprint=<FAILURE_FINGERPRINT> \
  --sha=<EXACT_SHA> \
  --run-id=<FAILED_RUN_ID> \
  --diagnosis=<PATH_TO_DIAGNOSIS_JSON> \
  --awareness=<PATH_TO_COGNITIVE_AWARENESS_JSON> \
  --primary-proof=<PATH_TO_PRIMARY_PROOF_JSON> \
  --programmer-twin-parity=<PATH_TO_TWIN_PARITY_JSON>
```

## 10. Hard stop rules

STOP immediately when:

- protocol read is missing;
- exact SHA is stale;
- supervisor lesson lacks provenance;
- the index would exceed capacity;
- a caller attempts deletion;
- a mutation targets tests/main/control-plane/gates;
- diagnosis-to-knowledge decision is `MISMATCH` or `INCONCLUSIVE`;
- canonical proof is missing;
- a valid counterexample exists.

A STOP is not a failure of the learning system. It is a request for stronger evidence or a Council lesson.

## 11. Learning lifecycle

RED detected  
→ exact evidence captured  
→ index searched  
→ ACTION-HISTORIAN-3 judges diagnosis vs knowledge  
→ triad attempts repair  
→ VERIFIED → record repair outcome  
or  
→ UNRESOLVED → record failure → Council escalation  
→ specialist teaches  
→ ACTION-HISTORIAN-3 adds advice to ACTION-INDEX-4000  
→ next exact-SHA attempt  
→ Canonical GREEN  
→ lesson becomes verified reusable knowledge

## 12. Non-negotiable boundary

The Action Vault index stores knowledge. It does not decide GREEN. The Council can request or provide teaching, but it does not bypass exact-SHA, causal proof, falsification, targeted regression, or Canonical CI.

End of protocol.
