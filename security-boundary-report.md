# Security Boundary Report — AI Planner / QuickFlow / Auto-Repair

## Provider trust boundary

Provider credentials are read from server-side `process.env` values in `api/flixo-agent.ts`. The repository client boundary contains no `VITE_*` provider key/token/secret declarations. The normalized gateway in `src/lib/agent/llm-provider.ts` also requires HTTPS.

The production planning path is fail-closed with respect to execution authority: provider output is schema-validated, canonical catalog-bound, and then compared with deterministic QuickFlow. A structurally valid but conflicting AI plan is treated as invalid for execution and the deterministic plan is retained.

## Browser network controls

`vercel.json` uses a restrictive Content Security Policy with `connect-src 'self'` and `frame-ancestors 'none'`. Provider endpoints are not authorized as client connection targets. The AI API does not emit permissive CORS headers, so the application does not open browser cross-origin access to provider endpoints.

## PR #748 trust-boundary application

The current Auto-Repair boundary retains the controls introduced by PR #748: exact-SHA detached execution targets, canonical-main controller provenance, read-only GitHub Actions permissions on the repair path, one execution mutation lane, independent Chair-1 audit, candidate SHA/provenance binding, adversarial falsification, no self-merge, and fail-closed exact-SHA merge-gate checks.

The unified merge gate requires the canonical Test System and protected CI/security workflows at the same SHA. External Vercel/provider failures are recorded separately and do not authorize application GREEN.

The durable task-history ledger is append-only: retries, corrections, and reversals are represented as new records rather than edits to historical records. The repair-attempt ledger is a bounded working-state structure and is not treated as the immutable historical authority.

The home-route AI agent is interaction-gated in addition to React lazy loading; initial page render does not mount the AI agent component.

## Residual findings

| Severity | Finding | Impact | Status |
|---|---|---|---|
| MEDIUM | `/api/flixo-agent` is publicly reachable without an independently enforced distributed quota/rate-limit layer in this code path. | A hostile caller could issue repeated valid requests and consume provider quota/cost even though secrets remain server-side. | OPEN — add a durable server-side quota/rate-limit control before unrestricted public AI usage |
| LOW | Initial home-route rendering could have requested the AI agent chunk immediately despite code-splitting. | Interaction-gated loading now prevents the AI agent module from rendering/loading until explicit user activation. | VERIFIED on exact SHA `e7db5ba…` |

## Security closure rule

The QuickFlow trust-boundary finding is closed only because exact-SHA canonical CI, certification, and merge-gate evidence are all GREEN on `e7db5ba8757114e00ba7c15213580a824d2862b6`. The remaining MEDIUM rate-limit finding stays open and does not authorize bypassing the execution→main promotion gate.
