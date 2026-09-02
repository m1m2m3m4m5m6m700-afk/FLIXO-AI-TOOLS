# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- The Executive Contract (`.github/workflows/ci-executive.yml`) is the sole PR verification authority; `error-report.json` is the single verdict voice (GREEN/RED) and always materializes as an artifact, whatever the test outcomes.
- Never hide a real failure: do not apply `|| true`/`continue-on-error` to the aggregator verdict steps, and keep the verdict status-based (not error-count-based).
