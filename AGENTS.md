# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- Before changing any reported problem, read its current state on the authoritative HEAD and apply `PROTOCOLS.md`.
- `PROTOCOLS.md` is hierarchical: do NOT attempt to execute every sub-protocol on every task. Invoke only applicable controls, while always enforcing the higher-precedence integrity, Exact-SHA, dynamic-verification, and root-cause rules.
- Every foundational fact must have one authoritative owner; derived representations must be mechanically checked for parity.
- Required verifiers MUST fail closed on unknown, missing, ambiguous, unproven, or stale states.
- Every technically guardable remediation MUST leave an invariant or regression lock at the strongest practical layer.
- Every changed file or behavior MUST have a causal justification; avoid unrelated cleanup during certification repair.
- A remediation is incomplete until its affected contract graph is coherent and its claims have matching exact-SHA evidence.
- Related failures MUST be grouped by true shared root cause rather than fragmented into duplicate fixes.
- Never weaken, skip, mask, allowlist, downgrade, or silently bypass a required failure to manufacture a green result.
- Any certification-affecting change invalidates prior release evidence and requires a fresh Exact-SHA verification cycle.
