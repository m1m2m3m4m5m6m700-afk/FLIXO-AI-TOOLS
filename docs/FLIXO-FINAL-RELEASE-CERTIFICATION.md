# FLIXO — Final Release Evidence

Status: **CURRENT MAIN VERIFIED / PRODUCTION VERIFIED**

## Exact current release identity
- Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`
- Current main SHA: `faf261be4476eccf293956d792bbb15e2e019061`
- Release commit: `fix(redteam): complete Cloudflare exact-SHA identity closure`
- Direct main deployment: verified by GitHub Actions and Cloudflare production identity

## Current main CI evidence
- FLIXO CI run `36515279116`: **PASS**
  - typecheck/lint/core contracts/build: PASS
  - model admission gate: PASS (fail-closed; no production model admitted)
  - npm test: PASS
  - production audit: PASS
  - exact build identity: PASS
  - Chromium browser smoke: PASS
  - trust-gate: PASS
  - Exact-SHA promotion proof: PASS
- FLIXO CodeQL run `36515279070`: **PASS**
- FLIXO Secret Scan run `36515279068`: **PASS**
- Release Drafter run `36515279121`: **PASS`
- Cloudflare deployment run `36515637149`: **PASS**

## Production deployment evidence
- Worker: `flixoai`
- Production origin: `https://flixoai.m1m2m3m4m5m6m700.workers.dev`
- Deployment SHA: `faf261be4476eccf293956d792bbb15e2e019061`
- Current-main freshness check: PASS
- Certified build artifact download: PASS
- Strict worker/origin allowlist: PASS
- Cloudflare credential validation: PASS
- Dry-run: PASS
- Deploy: PASS
- Immutable identity verification: PASS
- Production browser verification: PASS
- Deployment evidence artifact: produced by run `36515637149`

## Live production boundary
The production deployment is intentionally a **static browser-first Cloudflare Worker**.

- User media execution remains local/browser-side.
- `/api/*` is explicitly rejected by the production Worker with JSON 404 `API_NOT_EXPOSED_ON_STATIC_PRODUCTION_WORKER`.
- API paths are never allowed to fall through to SPA HTML.
- This is an intentional production boundary, not an unavailable backend presented as a working API.

## Production security boundary
The production Worker now applies:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- X-Frame-Options
- Strict-Transport-Security

These are enforced in the Worker itself rather than relying only on `vercel.json`.

## Exact-SHA identity boundary
Versioned deployment identity is valid only when:
1. the requested SHA matches the configured deployment SHA when configured;
2. the canonical `flixo-head-sha.txt` asset exists;
3. its contents match the requested SHA.

Mismatched or missing identity evidence fails closed.

## Red Team confirmed-case closure
The previously confirmed cases were re-baselined against `faf261be4476eccf293956d792bbb15e2e019061`:

- RT-001 Exact-SHA evidence gap: **CLOSED**
  - current main has fresh successful CI evidence on the exact SHA.
- RT-002 production SHA/provenance mismatch: **CLOSED**
  - Cloudflare production identity matches `faf261...`.
- RT-003 Vercel/Cloudflare split as the official production topology: **CLOSED**
  - Cloudflare is now the sole canonical production origin in `src/config/origin.config.ts`.
- RT-004 accidental public Agent API exposure: **CLOSED AS INTENTIONAL BOUNDARY**
  - static production explicitly rejects `/api/*` with JSON 404; the product's canonical MVP execution path is browser-local.
- RT-005 misleading Live-Agent-API certification evidence: **CLOSED**
  - production certification now validates the actual static production boundary rather than treating provider/API availability as a production requirement.
- RT-006 missing production security headers: **CLOSED**
  - headers are enforced directly by `src/worker.ts` and verified externally.
- RT-009 stale release-state documentation: **CLOSED IN THIS RELEASE DOCUMENTATION UPDATE**
  - current SHA and current run/deployment evidence are recorded here.

## Non-blocking states retained honestly
- Production LLM admission remains **BLOCKED / NONE ADMITTED** by policy because the model manifest contains no admitted production entry. The gate passes by failing closed.
- Rate limiting for the unexposed legacy Node API remains a hardening consideration, not a live production vulnerability on the current static origin.
- Historical issue #776 contains additional investigation items that are not reclassified as resolved without current-source evidence.

## Final disposition

**Current main: VERIFIED**  
**Production: VERIFIED**  
**Confirmed Red Team cases: CLOSED**  
**Static browser-first production boundary: ENFORCED**  
**No stale SHA is used as current evidence**
