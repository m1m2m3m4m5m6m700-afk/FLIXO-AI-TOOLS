# Safe Repair Agent Execution

This document defines the bounded mutation contract for the **Repair Agent / Execution Agent**. It is not a Task Agent contract.

The Task Agent is preparation-only. It may inspect, reason, prepare a bounded packet and hand off. Mutation starts only after the authorized mutation agent passes protocol admission and ownership locks.

## Canonical lifecycle

```text
FAILURE
  ↓
capture exact SHA + run + job + evidence
  ↓
diagnosis + RCA
  ↓
Task Agent preparation
  ↓
Executive / Coordination admission
  ↓
Repair Agent or Execution Agent mutation
  ↓
targeted regression + affected-contract verification
  ↓
canonical verification
  ↓
certification
```

## Mutation authority

Only agents admitted by `scripts/ci/repair-protocol.mjs` may mutate.

Current mutation roles:

`repairAgent`
`executionAgent`
`implementation`

The **Task Agent is explicitly not a mutation role**.

The central admission rule is enforced by `assertAgentAdmission({ actor, mutation: true, ... })`. A `taskAgent` mutation request fails closed with `REPAIR_PROTOCOL_MUTATION_ROLE_BLOCKED`.

## Branch and scope invariants

- `execution` is the sole working/repair/integration branch.
- `main` is the sole production/source-of-truth branch.
- No third branch exists as an active execution path.
- Mutation requires current protocol/session admission.
- Protected control-plane files remain protected.
- Scope and RCA ownership are established before mutation.

## Task Agent handoff boundary

The Task Agent may provide:

`taskId + baselineSha + scope + dependencies + preparedChanges + verificationPlan + proofObligations + prompt provenance`

The downstream mutation agent MUST independently revalidate:

- exact baseline SHA;
- RCA/evidence;
- prompt selection;
- ownership;
- dependencies;
- scope;
- security/control-plane policy;
- verification obligations.

A Task Agent packet is never a mutation authorization.

## Evidence and closure

Every mutation retains:

`repairChainId + repairAttempt + failureRunId + failedSha + failureFingerprint + causalEvidence + rootCause + sourceCorrection + regressionProof + canonicalExactShaEvidence + preventionOutcome`

Source correction must precede regression-only hardening. A test cannot substitute for the causal source repair.

Closure remains external to the mutation agent:

`mutation → targeted verify → affected graph → regression → recurrence → certification`

No Repair Agent or Task Agent may declare final GREEN/CLOSED/VERIFIED without canonical certification evidence.

## Trust boundary

Trusted controller policy, protocol definitions and canonical memory remain authoritative. Derived agent learning is supporting evidence only.

Historical evidence cannot certify a newer SHA.

## Failure and escalation

Repeated failure without verifiable progress is escalated through the existing repair supervisor/circuit-breaker path. External provider failures remain `BLOCKED_EXTERNAL` and are never converted into an internal source RCA without independent evidence.

