# Agent Rules

- Treat the repository as a clean foundation.
- Do not resurrect deleted product tools, catalogs, baselines, or legacy registries.
- Keep feature folders empty until a feature is explicitly introduced.
- Prefer the smallest change that passes `npm run check` and the E2E smoke test.
- Never claim a green release without fresh CI evidence.
- Before changing any reported problem, read its current state on the authoritative HEAD and apply `PROTOCOLS.md`; resolved problems MUST be recorded as `[SKIPPED - ALREADY RESOLVED]` and MUST NOT receive a redundant patch.
