# FLIXO-AI-TOOLS — Fast Test System

## Objective

The test system is designed to be fast without trading away proof of product correctness. A green result means the relevant contract was executed, not merely that the process started successfully.

## Layers

1. **Static Fast Gate** — type graph, lint, unit contracts, registry/manifest, routing, i18n, SEO, dependency, file/output integrity, assertion registry and performance/build contracts.
2. **Browser FAST** — all 22 canonical tool specs on Chromium, Firefox and WebKit. The CI matrix is sharded for throughput and runs without retries so failures remain honest.
3. **Output Proof** — tool flows must prove a meaningful result and delivery/download behavior. Unavailable tools must explicitly prove their unavailable/noindex state instead of pretending to be executable.
4. **Browser DEEP** — the full localization runtime matrix is retained as a separate certification layer across the 20 locales and 3 browsers.
5. **Certification** — exact SHA, execution evidence, coverage and zero-false-green checks are combined into one fail-closed decision.

## Why this is fast

- Static checks run concurrently according to the execution plan.
- Browser FAST uses 3 browsers × 2 shards, with six workers per shard.
- Deep localization remains outside the fastest feedback path.
- The dependency graph prevents unrelated checks from blocking one another while preserving required ordering.
- The test-matrix contract is a cheap static guard that prevents accidental removal of tools or output assertions from the FAST surface.

## Output correctness contract

For every ready tool, the browser test must demonstrate:

- the tool loads;
- the input is accepted or the expected safety rejection occurs;
- the operation produces a meaningful result;
- the result is observable/validated;
- the result can be delivered through the intended output/download path;
- tool-specific output contracts are asserted where available.

For a tool that is intentionally unavailable, the test must prove the unavailable state and `noindex` behavior. It must not be counted as a successful executable tool.

## Matrix invariants

- Canonical tool surface: **22 tools**.
- Browser surface: **Chromium + Firefox + WebKit**.
- Deep localization surface: **20 locales**.
- No tool may disappear from Browser FAST without the matrix contract failing.
- No ready tool may lose its output/result proof without the matrix contract failing.
- No unavailable tool may be silently treated as executable.

## Failure semantics

A failed test is not converted into GREEN by a downstream smoke test. Derived failures remain distinguishable from independent root causes. Certification remains fail-closed.

## Existing full certification remains intact

This layer supplements, rather than replaces, the existing 22-tool browser FAST suite, deep localization suite, output-contract registry and certification engine. The goal is **fast feedback + complete proof**, not a smaller test matrix.
