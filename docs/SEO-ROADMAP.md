# FLIXO SEO and Crawl Roadmap

## Current foundation

- Canonical tool registry drives route, SEO manifest, sitemap, and prerender coverage.
- Twenty locale variants are emitted with reciprocal `hreflang` links and `x-default`.
- Public tool pages are prerendered into crawlable HTML containing useful visible content.
- Structured data describes the page, application, and breadcrumb hierarchy where applicable.
- Internal links connect tools through semantic workflow relationships rather than category alone.
- Content-quality validation detects missing fields and near-duplicate localized content.
- AdSense implementation remains fail-closed until production consent and publisher configuration are verified.

## Stage 1 — Indexable release

Ship only when every indexable URL has a valid status, canonical URL, reciprocal locale references, useful HTML content, and an internal discovery path. Verify the generated sitemap and prerender output from the same commit.

## Stage 2 — People-first content quality

Every tool/locale page receives human review for accuracy, natural localization, tool-specific guidance, real constraints, and evidence of first-hand use. Content should answer the visitor's task without requiring another search. Word count is not used as a ranking target.

## Stage 3 — Production observability

Measure Core Web Vitals with real-user data and watch indexing coverage, crawl stats, canonical selection, alternate-page recognition, and soft-404/error patterns in Search Console. Laboratory tests are diagnostic; production data is authoritative.

## Stage 4 — Content expansion

Add genuinely useful use-case guides, troubleshooting pages, comparisons, and FAQs only where the product supports them. Do not create query variants merely to increase URL count. New content must have a distinct user purpose and internal evidence.

## Stage 5 — Monetization certification

Connect a Google-certified CMP integrated with IAB TCF for applicable EEA/UK/Switzerland traffic, verify the real publisher ID and `ads.txt`, test consent withdrawal, and validate ad placement on production routes before enabling personalized ads.

## Non-goals

- No fake traffic or automated search submissions.
- No keyword-stuffed pages.
- No mass translation without review.
- No schema markup whose claims are not supported by visible page content.
- No use of a fixed word-count quota as a proxy for usefulness.
