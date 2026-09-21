# ACTION AGENT RUNTIME v2

## Cognitive execution

INTAKE → CONTEXT_RETRIEVAL → PLAN → SYNTHESIZE → SIMULATE → EXECUTE → SELF_CHECK → INDEPENDENT_REVIEW → DIFFERENTIAL_VERIFY → VERIFY → LEARN

Every actionable Action failure gets a runtime packet bound to taskId + failureFingerprint + exact target SHA + failedRunId.

## Historical-first context

Before forming a repair strategy the runtime retrieves, in order:

1. exact fingerprint historical records;
2. verified historical agent activity for that fingerprint;
3. repair-memory cases and rejected strategies;
4. related causal-family cases;
5. teaching/anti-lessons.

Historical evidence is advisory. Current exact-SHA evidence outranks history.

## Reasoning gates

The runtime requires explicit unknowns, self-critique, adversarial review, and structured output. A strategy with stale evidence, repeated rejected strategy, or identity mismatch is blocked.

## Efficiency

The runtime uses bounded historical retrieval and tool budgets. Reads may run in parallel; source mutation is always serialized. After a mutation, the targeted surface is tested first. Full-suite CI remains the final certification authority, never the fast repair loop.

## Authority

No runtime packet can certify GREEN. Only Canonical CI / DAILY_FLIXO_GREEN_GATE can close the mission.


## Repair engineering

For source-repair missions, ACTION-REPAIR may construct bounded patch candidates only from explicit evidence anchors. A candidate is not a mutation and is not proof.

The candidate path is:

PATCH_SYNTHESIS → DETACHED_SANDBOX → TARGETED_CHECKS → DIFFERENTIAL_VERIFICATION → OWNER_REVIEW → REAL_MUTATION → CANONICAL_GREEN.

Sandbox simulation uses an isolated detached worktree pinned to the exact target SHA. Tests and main remain immutable. Gate-weakening patterns are rejected fail-closed.

Differential verification requires that the observed tracked diff equals the candidate scope, no unauthorized paths changed, no gate-weakening pattern appeared, and all required simulation checks passed. Canonical CI remains the only closure authority.
