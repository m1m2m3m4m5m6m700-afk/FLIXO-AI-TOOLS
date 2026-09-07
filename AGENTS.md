# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- Multi-agent work follows `.ci/agent-coordination/README.md`.
- An active writer must use an isolated `agent/<agentId>/<work-id>` branch and a non-empty writable claim.
- Never write after a scope, root-cause, target blob, or observed state has become stale; re-ingest and re-claim first.
- Diagnostics may inspect another agent's scope but may not write to it.
- The canonical matrix and its single certification remain the only release authority; agents never create competing certification gates.
