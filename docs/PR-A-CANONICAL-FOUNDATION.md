# PR-A — Canonical Foundation

This change establishes the canonical production origin and localized tool-route foundation. It deliberately does not include AdSense, prerender certification, Lighthouse, or editorial SEO certification.

## Contract

- `VITE_SITE_URL` is the only canonical production-origin input.
- Canonical generation is HTTPS-only and rejects local/preview/deployment origins.
- Runtime origin remains separate and may use the browser/local preview origin.
- S3 production certification consumes the same `VITE_SITE_URL` input; no Vercel hostname is hardcoded.
- Tests use `https://canonical.test` as an isolated HTTPS origin.
- Tool localization uses `getLocalizedToolPath(tool, locale)` rather than reconstructing routes from tool IDs.
- Sitemap tool URLs use the centralized route resolver.

## Explicitly deferred to PR-B / PR-C

- Full prerendered SEO HTML generation and validation.
- Complete hreflang A↔B symmetry certification.
- HTML parser migration.
- Structured-data expansion.
- AdSense runtime/TCF/ads.txt/legal/monetization certification.
- Lighthouse matrix changes.
