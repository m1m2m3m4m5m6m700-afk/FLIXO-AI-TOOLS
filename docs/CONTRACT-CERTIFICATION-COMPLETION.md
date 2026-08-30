# FLIXO Contract Certification Completion

This change closes the remaining gaps in the consolidated six-gate release model without deleting the existing coverage.

## G1 — Platform Contract

Adds a real browser proof that every unready tool route is kept behind the TanStack Router not-found boundary across all canonical locales. The test fails if an unready route exposes a tool workspace.

## G4 — Localization + SEO

Adds an all-public-route runtime matrix. For every canonical locale and every `isReady` public tool route it verifies HTTP success, locale/direction, non-empty title/description/H1, canonical path/origin, complete hreflang targets, and basic accessibility attributes.

## G5 — Runtime / E2E / Performance

Adds a canonical matrix suite covering real tool execution and download, corrupted-input rejection, responsive overflow at mobile/tablet/desktop widths, accessibility smoke, RTL/LTR direction, CI performance smoke, and worker health when workers are present.

The suite is registered in the canonical weighted Full Matrix so it executes in Chromium, Firefox, and WebKit as part of the immutable SHA/evidence/promotion contract.

## G6 — Production Certification

Production certification now requires the deployed `_flixo_build_manifest.json` SHA to equal the certified commit and probes every sitemap public route with canonical locale, canonical URL, and x-default/hreflang checks.

Release Certification also runs automatically on `main` pushes, waits for the canonical CI, G1, G4, and Full Matrix contracts, waits for the exact production deployment SHA, then certifies the real production surface.
