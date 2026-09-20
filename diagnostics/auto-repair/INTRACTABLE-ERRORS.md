# FLIXO Intractable Errors

This file records failure fingerprints that remain unresolved after **10 bounded repair cycles** on the same failure family.

## Purpose

An intractable entry is not a failure to verify. It is a controlled escalation record that prevents endless blind retries and gives the supervising repair agent a structured case to teach from.

## Escalation threshold

A failure family becomes `INTRACTABLE` when the same normalized failure fingerprint reaches **10 or more non-proposed repair attempts without a verified repair**.

The counter is fingerprint-based, not global: unrelated failures never consume each other's attempts.

## Agent-to-supervisor teaching protocol

For every `INTRACTABLE` case, the repair agent must provide:

1. **Identity** — fingerprint, root cause, affected workflow/job, and first/latest failed SHA/run.
2. **Evidence** — the strongest reproducible failure excerpts and the exact verification gates that failed or remained unavailable.
3. **Attempt history** — what was tried, outcome, rule, and why it did not become `verified-repair`.
4. **Rejected approaches** — changes that must not be repeated without new evidence.
5. **Open hypothesis** — the smallest evidence-backed hypotheses still worth testing.
6. **Teaching request** — explicitly ask the supervising agent to inspect the case and return a new repair strategy or additional diagnostic requirement.
7. **Exit condition** — define the evidence required before the case may leave `INTRACTABLE`.

### Supervising-agent response contract

The supervising agent should return a machine-readable lesson containing:

- `fingerprint`
- `newHypothesis`
- `diagnosticChange`
- `repairStrategy`
- `verificationPlan`
- `doNotRepeat`
- `exitCriteria`

A lesson must not be treated as successful merely because it is proposed. It becomes a success lesson only after exact-SHA verification and canonical CI are green.

## Safety rules

- Never bypass `verified-repair`.
- Never disable, skip, weaken, or falsify a failing security or verification gate to escape the state.
- Never mutate `main` directly as a workaround for an intractable case.
- After escalation, retries remain bounded and must use new evidence or a new diagnostic strategy.

## Cases

_No intractable cases have been registered yet._
