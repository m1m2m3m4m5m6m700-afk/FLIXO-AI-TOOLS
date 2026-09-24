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

## Residual findings

| Severity | Finding | Impact | Status |
|---|---|---|---|
| MEDIUM | `/api/flixo-agent` is publicly reachable without an independently enforced distributed quota/rate-limit layer in this code path. | A hostile caller could issue repeated valid requests and consume provider quota/cost even though secrets remain server-side. | OPEN — add a durable server-side quota/rate-limit control before unrestricted public AI usage |
| LOW | The client agent shell is lazy at the route boundary but remains a visible home feature; its heavy QuickFlow/AI imports become loadable when that lazy component is rendered. | Code-splitting is present, but strict interaction-gated loading could reduce initial JavaScript further. | OPEN performance follow-up; not an execution-safety defect |

## Security closure rule

No security finding in this report authorizes bypassing exact-SHA CI, canonical certification, or the execution→main promotion gate. Fresh exact-SHA evidence is required before closure.
