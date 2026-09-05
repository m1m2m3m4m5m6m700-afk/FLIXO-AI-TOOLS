# FLIXO Release Evidence

Release evidence keeps three facts independent:

1. **Code verification** — the exact commit passed the repository's deterministic checks.
2. **Deployment state** — the release was deployed, blocked, failed, or has not been observed.
3. **Runtime state** — production health is healthy, degraded, failed, or unknown.

A deployment-provider status is never used as a substitute for application verification.

The contract is deliberately small and fail-closed. It is intended to become the stable input/output boundary for future promotion and production-attestation jobs without granting any provider automatic release authority.
