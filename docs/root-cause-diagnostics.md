# Root Cause Diagnostics

The diagnostic workflow separates the existing verification contract into independent parallel gates so a failure in one area does not hide unrelated failures.

It covers typecheck, lint, engineering baseline, tool/router registry, localization, SEO/indexing, CI contract, security/integrity, release contracts, build/performance, and Chromium/Firefox/WebKit E2E.

The workflow is diagnostic-only and does not replace the canonical CI or promotion gates.
