# FLIXO Security Baseline

FLIXO uses a small, layered security baseline without adding a new application architecture.

## Existing gates

- TypeScript type checking
- ESLint
- Production build
- `npm audit --omit=dev --audit-level=high`
- GitHub CodeQL for JavaScript/TypeScript
- Isolated Playwright E2E checks per tool
- GitHub Secret Scanning / Push Protection where enabled in repository settings

## Added hardening

### Supply chain

CI contains a Socket gate. It runs as a blocking check when the repository secret `SOCKET_SECURITY_API_KEY` is configured. When the secret is not configured, the step is explicitly skipped so the baseline remains green while the integration is being provisioned.

### HTTP security headers

Vercel applies a conservative baseline including CSP, `nosniff`, referrer policy, permissions policy, and frame protection.

The CSP limits browser connections to the FLIXO origin and keeps external script trust disabled unless a concrete runtime dependency is intentionally added and reviewed.

## Input sanitization

DOMPurify is intentionally not installed globally. Ordinary UI rendering must use React text/nodes and must not use `dangerouslySetInnerHTML`. The only permitted `dangerouslySetInnerHTML` sinks are JSON-LD `<script type="application/ld+json">` blocks whose serialized payload is escaped for `<` before insertion.

Untrusted persisted state, API responses, checkpoints, and file inputs are validated at their runtime boundaries before entering domain state.

## Rules

1. Prefer platform controls and existing CI gates over new dependencies.
2. Add a security package only when a concrete threat or code path requires it.
3. Keep tool isolation intact.
4. Never weaken existing CI checks just to make a run green.
5. Treat browser-reported MIME as advisory; file safety must include extension, MIME, magic bytes, and decoder validation where applicable.
