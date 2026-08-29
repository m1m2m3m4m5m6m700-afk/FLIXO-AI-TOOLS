# SEO / Indexing Final Contract

The production SEO certification is a single merge gate over the existing canonical contracts. It verifies generated sitemap/robots artifacts and then runs the source SEO, indexing, breadcrumb, multilingual SEO, and strict locale-quality validators.

## Required invariants

- Canonical production origin is HTTPS and is not a local or preview origin.
- Sitemap and robots artifacts use that same origin.
- Sitemap localized URLs are derived from the ready-tool route contract.
- Each localized sitemap URL has the complete locale alternate set plus `x-default`.
- Canonical, hreflang, sitemap, robots, and indexing validators must all pass together.
- Public use-case routes remain canonical-only until localized use-case routes exist.
- The gate must fail on any contract drift; it must not weaken assertions or skip routes.
