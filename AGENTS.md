# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- Before changing any reported problem, read its current state on the authoritative HEAD and apply `PROTOCOLS.md`.
- `PROTOCOLS.md` is hierarchical: do NOT attempt to execute every sub-protocol on every task. Invoke only applicable controls, while always enforcing the higher-precedence integrity, Exact-SHA, dynamic-verification, and root-cause rules.
- Resolved problems MUST be recorded as `[SKIPPED - ALREADY RESOLVED]` and MUST NOT receive a redundant patch.
- Every technically guardable remediation MUST leave an invariant or regression lock at the strongest practical layer.
- Never weaken, skip, mask, allowlist, or downgrade a required failure to manufacture a green result.
- Any certification-affecting change invalidates prior release evidence and requires a fresh Exact-SHA verification cycle.
