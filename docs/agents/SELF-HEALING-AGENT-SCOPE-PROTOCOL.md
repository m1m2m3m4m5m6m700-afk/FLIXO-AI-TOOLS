# Self-Healing Agent Scope Protocol

## Purpose
The repair agent is a **self-healing CI component only**. It is not a general-purpose development agent and must not perform work outside an active, evidence-backed repair cycle.

## Autonomous bounded authority
The agent does **not** require a human work command once a canonical RED repair event exists. Its execution authority is equivalent to administrative mutation power **only inside `execution` and only for the current failure's demonstrated root cause, proportional hardening, and required regression proof**.

The authority contract is:
- `executionAuthority: BOUND_ADMIN_ON_EXECUTION_WITH_ERROR_SCOPE`
- `mutationScope: CURRENT_FAILURE_ROOT_CAUSE_AND_PROPORTIONAL_HARDENING_ONLY`
- `humanCommandRequired: false`

This is not unrestricted repository administration. Main, branch topology, trust controls, secrets, gates, and unrelated files remain protected unless the exact failure evidence makes a protected control the root cause and the dedicated security/trust gate explicitly authorizes that repair.

## Hard boundary
Every execution must be attributable to an active self-healing repair cycle or an explicitly selected incomplete repair task from `مهام.md`. If no valid repair target exists, the agent must remain dormant/fail-closed rather than inventing work. A canonical RED event is itself a valid activation signal; no separate human command is required.

```text
SELF-HEALING AGENT ONLY
        |
        +-- active failure / incomplete repair task
        |
        +-- capture exact SHA + evidence
        |
        +-- root-cause correction
        |
        +-- proportional hardening
        |
        +-- targeted regression
        |
        +-- canonical verification
        |
        +-- learn / close only after GREEN
```

## Allowed scope
The agent may:
- inspect repository state, CI evidence, tests, logs, and files needed to diagnose the repair target;
- modify only files required by the demonstrated root cause, proportional hardening, or its required regression proof;
- run targeted tests and required verification;
- commit and push repair changes only to the isolated repair branch;
- continue the same repair chain when a new red check appears;
- record fingerprints, evidence, repair outcomes, and prevention results in the self-healing memory surfaces.

## Out-of-scope work is forbidden
The agent must not use a repair cycle to:
- implement unrelated product features, UI work, SEO/i18n work, refactors, or performance work;
- perform opportunistic cleanup or style-only changes unrelated to the failure;
- change tests merely to make the existing failure pass;
- weaken, skip, suppress, downgrade, or remove required gates;
- alter branch protection, repository rules, CODEOWNERS, secrets, permissions, or other trust controls unless that exact control is the demonstrated root cause and the repair is explicitly authorized by the security repair scope;
- mutate `main`, force-push, rewrite history, or self-approve/merge its own repair;
- create a new unrelated repair chain because another failure appeared during the active cycle;
- claim completion from a targeted test or source mutation alone.

## Direct-execution boundary
Direct execution does **not** mean unrestricted execution. It means:

`DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH`

with all of the following invariants:
- execution branch exists and is not `main`;
- `mainBranchMutation` is `false`;
- mutation scope is `SELF_HEALING_REPAIR_ONLY`;
- every mutation has a repair rationale tied to the current failure/task;
- source correction precedes any regression-only change;
- every repair triggers fresh verification;
- canonical CI remains the closure authority.

## Scope token
The execution packet must contain:

`scopePolicy: SELF_HEALING_REPAIR_ONLY`

and:

`scopeEnforcement: FAIL_CLOSED`

A missing, conflicting, or unknown scope token is a boundary violation and must stop execution.

## Same-cycle rule
A newly observed red result during an active repair cycle remains inside the same repair chain. The agent captures it, fingerprints it, performs RCA, corrects the root cause, hardens proportionally, verifies, and rescans required checks. It does not broaden the task into unrelated development work.

## Closure
The agent remains active until Canonical CI is green on the exact pushed SHA, required red checks are zero, fresh evidence exists, and no active test failure remains unprocessed. Otherwise the cycle stays open or fails closed for review.
