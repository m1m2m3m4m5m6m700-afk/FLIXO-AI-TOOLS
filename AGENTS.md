# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- Multi-agent work follows `.ci/agent-coordination/README.md` and the transparent session ledger at `scripts/ci/active-sessions.json`.
- An active writer must check in before writing: use an isolated `agent/<agentId>/<work-id>` branch, an unexpired non-empty claim, and a matching active session entry.
- `.ci/agent-coordination/claims.json` is the sole authority for ownership; `scripts/ci/active-sessions.json` is a transparent projection and must never diverge from it.
- Never write after a scope, root-cause, target blob, or observed state has become stale; re-ingest and re-claim first.
- Diagnostics may inspect another agent's scope but may not write to it.
- Path, contract, or root-cause overlap between active agents is a fatal collision (`AGENT_COLLISION_DETECTED`).
- Cross-branch agent PRs are scanned fail-closed before coordination can pass.
- Session check-out requires releasing the claim and removing the corresponding active session entry.
- The canonical matrix and its single certification remain the only release authority; agents never create competing certification gates.
