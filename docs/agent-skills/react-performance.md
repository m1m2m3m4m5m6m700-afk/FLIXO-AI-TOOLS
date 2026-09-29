# FLIXO React Performance Skill

## Purpose
Review React/Vite changes for measurable client-side performance regressions.

## Review dimensions
- Avoid unnecessary client-side waterfalls.
- Keep lazy tool modules out of routes that do not need them.
- Preserve code splitting and stable vendor chunk boundaries.
- Minimize unnecessary rerenders and duplicated derived state.
- Prefer browser-local work in workers when it is CPU-heavy and safe.
- Preserve Core Web Vitals instrumentation.

## Proof
Any performance optimization must be paired with a regression test, a measurable runtime metric, or a bundle/request observation. Never claim a performance improvement from source inspection alone.
