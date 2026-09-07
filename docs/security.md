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

The CSP allows only the resource types FLIXO currently needs, including local scripts, WebAssembly, data/blob images, media, workers, and HTTPS API connections.

## Input sanitization and trusted HTML boundaries

DOMPurify is not installed globally because the current HTML insertion sites are trusted static-data boundaries rather than general-purpose HTML rendering paths. There are four intentional `dangerouslySetInnerHTML` usages in the current application:

- `src/routes/__root.tsx`: repository-controlled `GLOBAL_STRUCTURED_DATA`, serialized as JSON-LD and escaped for `<`.
- `src/routes/localized-tool-page.tsx`: repository-controlled localized tool SEO JSON-LD, serialized and escaped for `<`.
- `src/routes/use-case.tsx`: repository-controlled use-case JSON-LD, serialized and escaped for `<`.
- `src/routes/home-page.tsx`: repository-controlled locale `heroTitle` strings containing the intentional `<span>` presentation wrapper.

None of these four boundaries accepts uploaded files, request parameters, persisted user content, or remote HTML as its HTML source. This is an explicit trust boundary, not permission to introduce arbitrary HTML later. A future untrusted HTML path must use normal React elements or an explicit sanitizer at that boundary.

## Rules

1. Prefer platform controls and existing CI gates over new dependencies.
2. Add a security package only when a concrete threat or code path requires it.
3. Keep tool isolation intact.
4. Never weaken existing CI checks just to make a run green.
5. Keep trusted HTML boundaries narrow, repository-controlled, and explicitly documented.
