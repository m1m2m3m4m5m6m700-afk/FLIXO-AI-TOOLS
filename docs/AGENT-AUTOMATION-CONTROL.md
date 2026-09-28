# FLIXO Agent Automation Control Contract

## State machine

PROPOSED -> PLANNED -> APPROVED -> EXECUTING -> VERIFYING -> PASSED
                                                    -> FAILED
                                                    -> ROLLED_BACK
                                                    -> BLOCKED

No Agent may bypass the Control Plane for a state transition.

## Four budgets

Each autonomous execution must declare:
- max attempts
- max elapsed time
- max mutations
- max scope/steps

Budget exhaustion is BLOCKED or bounded recovery. It never causes an unbounded retry.

## Contracts

An executable capability requires:
Registry -> Schema -> Executor -> Output Contract -> Verifier -> Safety/Recovery boundary.

ACTIVE/EXECUTABLE is invalid when any link is missing or inconsistent.

## Green states

Infrastructure Green = infrastructure/build/test evidence.
Product Green = real user behavior and artifact verification.
MVP Certified = all MVP evidence plus Red Team plus Human Authority on one exact SHA.

Agents may collect evidence but cannot declare certification.

## Recovery

Recovery is bounded. Repeated identical failure is escalated. Replanning is controlled by policy. Failed recovery preserves evidence and terminates fail-closed.

## Sensitive operations

Merge, main promotion, security/CI weakening, test deletion, MVP scope changes, capability activation, and certification require deterministic gates and Human Authority where defined by repository policy.
