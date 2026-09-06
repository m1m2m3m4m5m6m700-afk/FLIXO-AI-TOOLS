# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.

## Runtime i18n pitfalls

- `main.tsx` installs several body-wide auto-localization `MutationObserver`s (tool-ui-runtime/supplement/completeness(. On non-en locales they translated DOM text under React, creating an endless mutation ping-pong that froze non-en routes (`/es` etc) in production while `/en` (early-return) worked. Fix: coalesce every observer pass through `requestAnimationFrame` (one pass per frame) so React commits paint between passes; en route stays a no-op guard. Verify non-en smoke on `build:runtime`+preview, not just dev (Vite dev masked the freeze (`/ms` hydrated fine) while prebuilt chunks exposed it. Keep any new global DOM observer rAF-coalesced.).
- `run check` includes lint over `*.mjs` probes at repo root — delete diagnostic scripts that contain unused vars before running the full suite.
