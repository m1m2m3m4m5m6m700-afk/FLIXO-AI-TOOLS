# FLIXO Tool Platform — 1000-Tool Foundation

## Objective

The platform must support 1,000+ tools without creating one-off routing, SEO, localization, readiness, or test systems per tool.

The authoritative input is the canonical tool definition. A tool is declared once; the single Tool Loader builds the indexed catalog and shared consumers derive the rest.

## Core model

```text
Canonical Tool Definition
   ↓
Single Tool Loader
   ↓
Validated TOOL_REGISTRY
   ↓
TOOL_CATALOG
   ├── byId
   ├── byPath
   ├── byAlias
   └── ready
   ↓
Router / SEO / Sitemap / i18n / Browser Matrix / Certification
```

## Scaling invariants

1. Tool identity is unique and stable.
2. Canonical paths are unique.
3. Aliases cannot collide with canonical paths or other aliases.
4. Readiness is explicit; non-ready tools are never promoted by inference.
5. Components remain lazy-loaded so registering more tools does not eagerly execute all tool modules.
6. Runtime consumers perform indexed lookup rather than repeatedly scanning the full registry.
7. Operational metadata is additive and typed; missing classification is surfaced instead of silently guessed.

## Complexity target

Registry/catalog validation is `O(n)` at initialization. Normal lookup is `O(1)` through maps. Deterministic catalog ordering is enforced by canonical ID sort. Adding a tool therefore does not require another per-tool router table or lookup loop.

## Management contract

Each future tool should eventually declare an operational profile covering lifecycle, execution model, capabilities, contract levels, output class, security profile, localization scope, browser ownership, and evidence requirements. This metadata belongs beside the tool identity and should be consumed by generic engines.

The current foundation now binds explicit operational metadata through the canonical definition. The migration path is:

```text
canonical definition → validated operational profile → indexed discovery → contract-enforced → certified
```

## Test ownership

`test-tool-platform-catalog` verifies the shared catalog boundary once. Per-tool behavior remains owned by the canonical tool contract/browser test, preventing the catalog layer from becoming a second copy of application tests.

## Performance direction

At 1,000 tools, the platform should avoid:

- importing every tool implementation during discovery;
- scanning all tools for every route request;
- maintaining duplicated registry copies for router/SEO/sitemap;
- generating a bespoke test suite for each administrative concern.

The intended architecture is one registry, one indexed catalog, shared contract engines, and data-driven matrices.


## Repair/Executor boundary

The execution pipeline consumes the canonical executor binding and recovery policy instead of maintaining a second executable-tool allowlist. Verification remains capability metadata-driven through the canonical verifier contract. Output contracts bind through the canonical output-contract identifier.

The compatibility module for executable tool IDs is derived from the canonical capability registry and no longer owns a separate list of executable IDs.
