# FLIXO Agent Automation Control Contract

This document defines the operational invariants for bounded agent automation. It does not create a second registry, execution path, or certification authority.

## Success states

The repository MUST distinguish:
- Infrastructure Green: required infrastructure/CI checks pass on one exact SHA.
- Product Green: required user-facing behavior is verified on that same exact SHA.
- MVP Certified: Product Green plus the required red-team and human release gate on that exact SHA.

No state implies another state without fresh evidence.

## Authority model

- Human/Master: final acceptance, release, certification.
- Control Plane: state, policy, locks, budgets, and evidence.
- Planner: proposes intent and an execution plan; it has no mutation or certification authority.
- Executor: deterministic execution only through the canonical Registry/execution boundary.
- Verifier: determines whether the requested output actually satisfies its contract.
- Manual tool routes remain usable without the Agent Router.

No auxiliary agent may create a competing registry, execution path, certification path, or authority model.

## Four execution budgets

Every autonomous execution MUST be bounded by:
1. Attempts: retry/recovery count.
2. Time: execution timeout.
3. Mutations: number of repository/product state mutations permitted by the governing task.
4. Scope: maximum plan/step surface permitted by the governing task.

Budget exhaustion MUST transition to recovery or fail-closed escalation. It MUST NOT trigger an unbounded retry loop.

## Deterministic gates

Agents may propose but MUST NOT autonomously:
- merge or promote to main;
- delete/disable tests or CI;
- weaken security boundaries;
- certify an MVP;
- promote a capability to ACTIVE.

These actions require deterministic repository/policy gates and, where specified, human acceptance.

## Canonical ACTIVE contract

A capability may be executable/ready only when the canonical contracts agree:
Registry -> schema -> executor -> output contract -> verifier -> safety/recovery boundary.

A mismatch is a failure, not a warning.

## Evidence

Evidence is valid only when it is bound to the exact commit SHA under verification. Skipped, cancelled, stale, contradictory, or missing required evidence MUST NOT be treated as success.

## User-behavior verification

Product Green requires end-to-end verification of representative user workflows in a real browser/runtime where applicable, including inspection of the produced artifact rather than only command/process exit codes.

## Recovery

Recovery is bounded and auditable. A failed execution may retry only within the canonical recovery budget. Replanning is bounded by policy. When recovery cannot establish a verified result, the system MUST fail closed and preserve the failure evidence.

## Release gate

MVP certification requires Red Team verification and human review against the same exact SHA. Historical green results remain historical after a newer commit.
