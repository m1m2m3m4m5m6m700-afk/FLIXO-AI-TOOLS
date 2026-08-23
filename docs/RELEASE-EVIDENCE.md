# FLIXO Release Evidence

Release evidence separates three independent facts:

1. **Code verification** — the exact commit passed the repository's required deterministic checks.
2. **Deployment state** — the artifact was deployed, blocked, failed, or has not been observed.
3. **Runtime state** — production health is healthy, degraded, failed, or unknown.

A deployment provider status is never treated as proof of application correctness by itself.

The contract is intentionally small and fail-closed. Future CI and deployment jobs may produce a JSON evidence document and validate it with `npm run validate:release-evidence`.
