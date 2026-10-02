# FLIXO Public Launch Agent Dispatch

These are execution roles controlled by the launch program. They are not new runtime authorities and cannot bypass repository gates.

| Agent | GitHub packet | Responsibility | Mutation authority | Current state |
|---|---:|---|---|---|
| RELEASE-1 | #933 | Candidate SHA, evidence, release manifest | execution branches only | ACTIVE |
| PRODUCT-2 | #934 | Public product surface and activation | execution branches only | ACTIVE |
| SEO-3 | #935 | SEO, canonical, hreflang, indexing readiness | execution branches only | ACTIVE |
| OBS-4 | #936 | Privacy-safe analytics and reliability contract | execution branches only | ACTIVE |
| DOCS-5 | #937 | Trust, security, support and operations docs | execution branches only | ACTIVE |
| GROWTH-6 | #938 | Distribution assets and channel runbooks | execution branches only | ACTIVE |
| RED-7 | #939 | Independent adversarial verification | READ_ONLY unless explicitly assigned a repair | ACTIVE |
| CERT-8 | #940 | Final exact-SHA certification | READ_ONLY | BLOCKED until all gates are green |

## Control rules

1. Agents may not write `main` directly.
2. `execution` is the only integration lane for production promotion.
3. No agent may self-certify its own mutation.
4. Evidence must identify the exact SHA.
5. Pending, skipped, cancelled, neutral or unavailable checks are not PASS.
6. Public claims must remain inside `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md`.
7. Certification is fail-closed.
8. External/legal actions remain explicit blockers rather than fabricated completion.

## Active execution branch

`public-launch-execution`

Integration path:

`public-launch-execution -> execution -> main -> production verification -> launch certificate`
