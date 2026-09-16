# FLIXO Autonomous Repair Protocol

Protocol version: **1**

The repair agent is governed by a fail-closed state machine. A repair is never considered successful because files changed or a single command passed.

## Mandatory lifecycle

`DISCOVERY → EVIDENCE_LOCK → RCA → RISK_GATE → PLAN → REPRODUCE → REPAIR → SCOPE_VERIFY → REGRESSION_VERIFY → ORIGINAL_GATE_VERIFY → LEARN → PREVENT → CLOSE`

Any unsafe, unsupported, ambiguous, or exhausted path transitions to `ESCALATE`.

## Hard rules

- Evidence identity is locked to the failure fingerprint and target commit SHA.
- The attempt budget is finite; exhaustion blocks autonomous mutation.
- Protected, workflow, security-sensitive, and other human-gated areas cannot be auto-fixed.
- Every mutation must pass bounded file/line scope checks.
- The original failed gate must be re-verified when applicable.
- Regression verification is mandatory before learning a repair as successful.
- Rollback is mandatory after failed verification or an execution exception.
- A verified repair must contain complete provenance: failure → attempt → rule → changed paths → verification → learning/prevention.
- Missing or malformed evidence prevents `CLOSE`.
- Historical memory can influence planning but can never override safety policy.
- The protocol never weakens CI/certification gates to manufacture green status.

## Risk levels

- **AUTO-FIX:** deterministic, bounded, high-confidence mutation in allowed paths.
- **GUARDED-FIX:** mutation requires stronger verification and remains subject to all scope/rollback gates.
- **HUMAN-GATE:** protected/security/workflow/ambiguous changes or insufficient confidence.

## Learning contract

Only `verified-repair` outcomes may strengthen a repair playbook. Failed, rolled-back, blocked, or proposal-only attempts remain evidence and cannot be treated as successful knowledge.
