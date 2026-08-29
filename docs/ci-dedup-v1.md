# CI Verification Ownership and Deduplication

The repository keeps every unique verification surface while executing each surface once in its intended owner gate.

## Blocking PR ownership
- `CI`: typecheck, lint, runtime build/performance, production audit, Socket, secret history, CodeQL, core contracts, and S3 static certification.
- `S4 Runtime + E2E Gate`: browser/runtime coverage across Chromium, Firefox, and WebKit.
- `Localization — 20 Locale Gate`: all 20 locales with static and runtime localization evidence.
- `SEO Production Certification`: generated production SEO artifacts plus SEO/indexing contract evidence.

## Removed duplicate surfaces
- Standalone Browser Smoke was removed because S4 already executes the same Playwright specifications, including the performance route-loading suite.
- `Localization Core Gate` was removed because the 20-locale gate explicitly executes EN and AR with the same core surfaces.
- `Phase 3 Chain E2E` was removed because S4 executes the complete Playwright suite, including the chain E2E specification.
- `Parallel Diagnostics` and `Root Cause Diagnostics` no longer run automatically on `main`; they are manual diagnostic microscopes and do not duplicate every normal main run.
- Canonical Verification is an aggregator and does not rerun prerequisite suites.

## Safety rules
- A required verification remains required; only duplicate execution is removed.
- Unknown change scope selects broader verification rather than skipping tests.
- `SKIP`, missing execution, and unavailable evidence never count as success.
- Exact commit SHA remains part of promotion evidence.
