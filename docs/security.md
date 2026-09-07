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

The CSP keeps browser connections limited to the FLIXO origin plus the explicitly reviewed jsDelivr dependency currently required by the application. External script trust must remain intentional and reviewed; WebAssembly execution and inline styles are permitted only where the current runtime requires them.

## Input sanitization and trusted HTML boundaries

DOMPurify is not installed globally because ordinary UI rendering is implemented with React text/nodes. `dangerouslySetInnerHTML` is not permitted for ordinary UI content.

The only permitted `dangerouslySetInnerHTML` sinks are repository-controlled JSON-LD `<script type="application/ld+json">` blocks, and each serialized payload must escape `<` before insertion. Current application boundaries are:

- `src/routes/__root.tsx`: repository-controlled `GLOBAL_STRUCTURED_DATA`, serialized as JSON-LD and escaped for `<`.
- `src/routes/localized-tool-page.tsx`: repository-controlled localized tool SEO JSON-LD, serialized and escaped for `<`.
- `src/routes/use-case.tsx`: repository-controlled use-case JSON-LD, serialized and escaped for `<`.

`src/routes/home-page.tsx` must render the localized hero title with normal React nodes; it must not reintroduce `dangerouslySetInnerHTML`. Its intentional `<span>` presentation wrapper is parsed into React text plus an actual `<span>` element, not injected as HTML.

None of these JSON-LD boundaries accepts uploaded files, request parameters, persisted user content, or remote HTML as its HTML source. This is an explicit trust boundary, not permission to introduce arbitrary HTML later. A future untrusted HTML path must use normal React elements or an explicit sanitizer at that boundary.

## Rules

1. Prefer platform controls and existing CI gates over new dependencies.
2. Add a security package only when a concrete threat or code path requires it.
3. Keep tool isolation intact.
4. Never weaken existing CI checks just to make a run green.
5. Keep trusted HTML boundaries narrow, repository-controlled, and explicitly documented.
6. Treat browser-reported MIME as advisory; file safety must include extension, MIME, magic bytes, and decoder validation where applicable.
