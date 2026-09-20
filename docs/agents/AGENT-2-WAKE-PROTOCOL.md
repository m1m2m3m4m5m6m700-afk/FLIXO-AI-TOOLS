# Agent 2 Failure-Wake Protocol

## Identity

Agent **2** is the execution-side repair partner for GitHub failures.

## Wake chain

```
GitHub failure
→ FLIXO Execution Bot Watchdog
→ Daily FLIXO Green Gate
→ exact-SHA classification
→ diagnostic prompt bundle
→ Issue #759 canonical wake marker
→ Council Wake Bootstrap
→ Agent 2 / execution recovery session
```

The wake packet is emitted only for actionable execution states:

- `RED_INTERNAL`
- `BLOCKED_EXTERNAL`
- `FAIL_CLOSED`

The wake packet is bound to the exact `execution` SHA and a failure fingerprint. Duplicate wakes for the same SHA/fingerprint are suppressed.

## Mandatory handoff

Every wake carries:

- exact execution SHA
- failure fingerprint
- target workflow/run when available
- current classification and root-cause hint
- prompt bundle digest/count
- the required work package
- targeted-test policy
- learning requirements

## Repair protocol

```
WAKE
→ READ current SHA
→ READ failure evidence
→ IDENTIFY symptom
→ IDENTIFY trigger
→ IDENTIFY propagation
→ IDENTIFY violated invariant
→ establish RCA
→ repair root cause
→ targeted regression
→ affected-contract verification
→ exact-SHA verification
→ record lesson / anti-lesson
```

A new commit does **not** by itself justify a full-suite rerun. Verification expands only when the repaired invariant, contract, security boundary, or certification proof requires it.

## Learning contract

The repair record must preserve enough information for the next small task:

`fingerprint + RCA + failed hypothesis + successful strategy/anti-strategy + changed scope + targeted proof + exact SHA`

Memory is advisory; fresh evidence remains authoritative.

## Fail-closed rules

Agent 2 must stop mutation when:

- the SHA is stale or ambiguous;
- failure evidence cannot be captured;
- the RCA is unknown at the mutation boundary;
- the requested repair exceeds the declared scope;
- the evidence points to an external blocker that repository changes cannot fix.

Never suppress a failure, weaken a gate, skip a required proof, or convert an external blocker into a source-code workaround.

## Continuous Liveness Contract

An open repair session is never allowed to become SLEEP/IDLE/SILENT/ABANDONED. Waiting for CI or an external provider uses `WAITING_EXTERNAL` with heartbeat. Missing heartbeat or expired lease moves the session to `RECOVERING` and triggers the existing supervisor/wake path.

Heartbeat command: `node scripts/ci/repair-lease.mjs heartbeat ...`
Liveness contract: `scripts/ci/agent-liveness-protocol.mjs`
