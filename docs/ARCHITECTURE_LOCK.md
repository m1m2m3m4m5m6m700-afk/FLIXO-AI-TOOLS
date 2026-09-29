# FLIXO Architecture Lock

Baseline is bound to the execution stream and must be refreshed whenever canonical control-plane contracts change.

## Locked architecture

Human Authority -> deterministic Control Plane -> Planner / Executor / Verifier.
The manual tool path remains independent.

Governance is deterministic CI/repository policy, not an autonomous authority.

## Allowed authority roles

| Role | Authority |
|---|---|
| PLANNER | propose plan/intents only |
| EXECUTOR | invoke canonical registered execution only |
| VERIFIER | verify output/evidence only |
| GOVERNANCE | deterministic gates/policy only |

Advisory/helper profiles are role overlays. They do not constitute additional authority classes and cannot mutate, merge, promote, certify, or change scope outside the canonical Control Plane.

## Non-negotiable invariants

- No Agent directly changes Control Plane state.
- No Agent certifies.
- No Agent merges or promotes to main.
- No Agent changes MVP scope.
- No Agent bypasses the canonical execution gate.
- Autonomous execution is bounded by attempts, time, mutations, and scope.
- Evidence is valid only when bound to the exact SHA under verification.
- Infrastructure Green, Product Green, and MVP Certified are separate states.
- Manual execution remains functional without the Agent Router.

## Baseline agent seats

The runtime may contain many advisory profiles, but only these authority seats exist:
- Planner
- Executor
- Verifier
- Governance

External workers such as repair/review adapters are disposable role overlays and have no independent authority.

## Change control

Adding a new authority seat, new mutation path, second registry, second certification path, or autonomous promotion path is prohibited without explicit Human Authority approval.
