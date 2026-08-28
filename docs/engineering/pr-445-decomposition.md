# PR #445 Decomposition — Phase 0 Baseline

Date: 2026-08-29
Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`

## Baseline

- `main` = `7638c8995c8ad631acc263f1753df5085fe45ca0` (`ci(i18n): strict 20-locale localization release engine`)
- PR #445 = closed, not merged
- #445 base SHA = `7638c8995c8ad631acc263f1753df5085fe45ca0`
- #445 head branch = `feat/adsense-route-audit-20260828`
- #445 head SHA = `80dcc998a9f0e0d7f9c4d464ef0a688d5bbaf`
- #445 reported scope = 25 commits / 46 changed files / 2406 additions / 416 deletions
- Phase 0 working branch = `refactor/pr445-phase0-baseline`

PR #445 is treated as a source-of-changes only. It is not reopened, revived, or merged wholesale.

## Architectural finding

The PR is not a single-domain change. Its diff mixes:

```text
Canonical origin
Runtime/test origin separation
Routing / route graph
Registry / manifest contracts
SEO / sitemap / robots
Prerender HTML
20-locale localization
AdSense runtime + consent
AdSense route readiness
Content quality
Lighthouse / performance
CI governance
S4 runtime / E2E
Static gate behavior
Legal routes
Tool-specific SEO content
```

The most important decomposition rule is therefore to preserve the useful intent while re-homing each change into the layer that owns the contract.

## #445 file map

| File | Current #445 role | Target phase | Classification | Reason / action |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | runtime/production build split, canonical env, gate messaging | P1 + P10 | ADAPT | Keep runtime/production separation; rewrite canonical contract and gate ownership around the new origin/CI model. |
| `.github/workflows/lighthouse.yml` | manifest-derived Lighthouse matrix | P9 | ADAPT | Strong direction; keep matrix generation but make it consume the final route contract and avoid duplicated build work. |
| `.github/workflows/root-cause-diagnostics.yml` | runtime diagnostics build | P10 | ADAPT | Preserve diagnostic separation; align names and dependencies with final gate taxonomy. |
| `.github/workflows/s4-runtime-e2e.yml` | runtime build for S4 browser gate | P4 + P5 | ADAPT | Keep local/runtime target separation; route/locale assertions must use the canonical resolver contract. |
| `.github/workflows/seo-quality.yml` | content + full crawl certification | P6 + P10 | ADAPT | Split editorial observation from blocking SEO artifact certification. |
| `docs/ADSENSE-COMPLIANCE-2026.md` | AdSense policy/governance | P7 + P8 | KEEP | Useful governance document; retain with ownership clearly separated from Google policy claims. |
| `docs/CONTENT-STANDARDS.md` | people-first content contract | P5 + P6 | KEEP | Retain as editorial standard; CI must remain a guardrail, not a substitute for human review. |
| `docs/MONETIZATION.md` | monetization release gate | P7 + P8 | KEEP | Retain as release policy; production configuration stays external and fail-closed. |
| `docs/SEO-ROADMAP.md` | SEO/indexing roadmap | P6 + P8 | KEEP | Retain; update references after final architecture settles. |
| `package.json` | adds/re-wires many scripts and dependencies | P1–P10 | REWRITE | This is a cross-layer concentration point. Rebuild scripts from final ownership rather than cherry-picking the large command-chain edit. |
| `performance-budget.json` | initial payload budget semantics | P9 | ADAPT | Keep concept; validate budget semantics against final bundling/runtime model. |
| `playwright.config.ts` | runtime vs production server separation | P4 + P5 + P9 | ADAPT | Keep test-origin separation; simplify once route/origin contracts are centralized. |
| `scripts/generate-lighthouse-matrix.mjs` | family × locale matrix generation | P9 | KEEP | Strong candidate for direct reuse, pending manifest/router alignment. |
| `scripts/generate-robots.mjs` | canonical robots generation | P1 + P6 | ADAPT | Keep generator; replace dependency on legacy i18n origin with centralized canonical-origin contract. |
| `scripts/generate-sitemap.mjs` | manifest-derived sitemap | P1 + P2 + P6 | ADAPT | Keep intent; route URLs must come from the single route resolver, not duplicated path logic. |
| `scripts/prerender-seo-pages.mjs` | crawler-first localized HTML prerender | P6 | REWRITE | Useful intent, but route generation, related links, HTML assembly, and locale content need to be redesigned around final contracts. |
| `scripts/run-lighthouse-shard.mjs` | per-family/locale Lighthouse shard | P9 | KEEP | Reuse after route resolver and runtime target contract are stable. |
| `scripts/test-i18n-contract.mjs` | i18n harness origin workaround | P5 | ADAPT | Keep test intent; remove repository-specific production-origin fallback from test code. |
| `scripts/validate-adsense-readiness.mjs` | AdSense central boundary/readiness | P7 + P8 | ADAPT | Keep checks, but separate architecture checks, runtime checks, editorial observations, and production verification. |
| `scripts/validate-adsense-route-audit.mjs` | ready-tool × locale monetization audit | P8 | ADAPT | Keep route coverage; route identity must come from final route contract. Content-quality findings should be non-blocking unless monetization is explicitly enabled. |
| `scripts/validate-ci-contract.mjs` | workflow structure assertions | P10 | ADAPT | Keep as CI governance contract; rewrite to assert final layer ownership instead of implementation details from #445. |
| `scripts/validate-content-quality.mjs` | within-locale similarity detection | P6 | KEEP | Good as a signal; keep thresholds as engineering heuristics, not search-ranking rules. |
| `scripts/validate-indexing.mjs` | sitemap/robots/root/indexing assertions | P1 + P6 | ADAPT | Preserve source + artifact checks; canonical origin must be supplied by the centralized contract. |
| `scripts/validate-performance-budget.mjs` | initial payload/lazy JS accounting | P9 | ADAPT | Keep measurement model if confirmed against actual Vite output; do not weaken budgets to hide regressions. |
| `scripts/validate-prerendered-content.mjs` | prerender visible-content validation | P6 | REWRITE | Current parser logic is source-specific and should be replaced by a real HTML parser/DOM-based validator. |
| `scripts/validate-prerendered-seo.mjs` | canonical/hreflang/prerender validation | P6 | REWRITE | Preserve invariants, but validate target URLs through the route contract and enforce true hreflang symmetry. |
| `scripts/validate-s3-static-gate.mjs` | static entrypoint, output, allowlist, build, JS graph, budget checks | P3 + P4 + P10 | REWRITE | Too many domains in one gate. Split file safety/output/static governance and remove hardcoded production-origin assumptions. |
| `scripts/validate-site-origin.mjs` | origin contract probe | P1 | KEEP | Keep as a thin adapter around the centralized canonical-origin API. |
| `src/adsense/AdSlot.tsx` | fail-closed ad runtime | P7 | KEEP | Central boundary is correct; test lifecycle, consent revocation, and route surface eligibility separately. |
| `src/adsense/policy.ts` | AdSense policy, TCF, surface blocks | P7 | KEEP | Strong centralization candidate; production certification remains configuration/verification, not repository truth. |
| `src/components/command-palette.tsx` | user-facing UI text update | P5 | ADAPT | Preserve functional change but move all visible copy into the localization contract. |
| `src/config/tool-definitions/types.ts` | tool contract changes | P2 | ADAPT | Keep only fields that are actually required by the final manifest/router model. |
| `src/config/tool-relations.ts` | related/prerequisite tool graph | P2 + P6 | ADAPT | Keep graph semantics; SEO should consume this graph rather than inventing relation fallback rules. |
| `src/lib/i18n/config.ts` | origin split + locale metadata | P1 + P5 | REWRITE | This is the core origin contract. Replace the #445 mixed fallback model with an explicit canonical/runtime/test architecture. |
| `src/lib/seo/image-compressor-head.ts` | tool-specific SEO head data | P6 | ADAPT | Preserve real tool metadata; ensure it is sourced from the same tool/SEO manifest. |
| `src/lib/seo/tool-seo.ts` | localized tool SEO lookup | P5 + P6 | ADAPT | Keep lookup API; route/locale IDs must be validated against manifest and resolver contracts. |
| `src/routes/__root.tsx` | root metadata/indexing changes | P1 + P6 | ADAPT | Keep public metadata behavior, but derive canonical URLs through the centralized origin/route layer. |
| `src/routes/ar-image-compressor.tsx` | localized route/tool SEO behavior | P2 + P5 + P6 | ADAPT | Keep only behavior that matches the manifest/router source of truth; eliminate route-specific duplication. |
| `src/routes/cookies.tsx` | legal route | P7 | KEEP | Keep as a legal surface; verify actual operator/vendor/retention content before production use. |
| `src/routes/en-image-compressor.tsx` | localized route/tool SEO behavior | P2 + P5 + P6 | ADAPT | Same rule as Arabic route; route identity must not drift from manifest. |
| `src/routes/pdf-tools.tsx` | route/tool indexing or relations | P2 + P6 | ADAPT | Preserve verified route behavior; remove duplicated route construction. |
| `src/routes/privacy.tsx` | legal route | P7 | KEEP | Keep and verify production legal content. |
| `src/routes/route-tree.ts` | generated route graph | P2 | ADAPT | Never hand-edit derived output; regenerate from source route definitions and validate against manifest. |
| `src/routes/terms.tsx` | legal route | P7 | KEEP | Keep and verify production legal content. |
| `src/tools/pdf-compressor/index.tsx` | tool-specific runtime/UI change | P4 + P5 | ADAPT | Preserve user-facing functionality; localization/output assertions must remain tool-specific and independent of SEO. |
| `tests/image-compressor.spec.ts` | E2E assertions for image compressor | P4 + P5 | ADAPT | Preserve real user workflow coverage; remove assumptions about production origin and keep selectors stable. |

## Cross-file findings from the actual PR diff

### 1. Canonical origin needs redesign, not cherry-pick

The #445 change attempted to separate runtime and canonical origins but still contained a Vercel production-domain fallback in `src/lib/i18n/config.ts`. Its own comments prohibit Vercel deployment origins from canonical use while the implementation can still derive a fallback from `VERCEL_PROJECT_PRODUCTION_URL`. This contradiction means the correct action is a fresh canonical-origin contract rather than transplanting the implementation. fileciteturn3file0L73-L85

### 2. Prerender needs a proper route source of truth

The #445 prerenderer already depends on `TOOL_MANIFEST`, `TOOL_SEO_MANIFESTS`, locale metadata, and tool relations, which is directionally correct. However, it independently manufactures localized URLs and related links, so it must be rewritten to call the final route resolver. fileciteturn3file0L64-L65

### 3. Content validation must not become an HTML sanitizer

The PR adds a prerendered-content validator that strips markup using custom string scanning. The final architecture should use a real HTML parser for DOM-aware validation and keep sanitizer behavior outside the validator contract. fileciteturn3file0L100-L101

### 4. S3 static gate is over-coupled

The PR expands the S3 gate across brand assets, builds, Google SEO, localization, AdSense, prerendering, JS graph, performance, changed-file hygiene, and working-tree state. That is too broad for one domain owner and is a primary source of diagnostic complexity. It should be decomposed during P3/P4/P10 rather than carried forward intact. fileciteturn3file0L108-L109

### 5. Lighthouse direction is reusable

The manifest-derived Lighthouse matrix is one of the strongest candidates for direct extraction: it generates coverage from ready tools × locales and uses a local runtime probe rather than making canonical SEO origin a browser prerequisite. fileciteturn3file0L52-L69

### 6. CI/build separation is directionally correct but not yet the final contract

The PR separates `build:runtime` from the production SEO build and gates the latter on `SITE_URL`. That separation should survive, but the implementation belongs to the final canonical-origin and CI-governance layers rather than remaining embedded in a broad PR. fileciteturn3file0L4-L5

## Final phase allocation

```text
P0  Baseline / inventory / governance
P1  Canonical + route foundation
P2  Registry ↔ router contract
P3  File safety
P4  Output integrity + runtime E2E
P5  20-locale localization
P6  SEO + prerender + indexing
P7  AdSense runtime
P8  AdSense route certification
P9  Lighthouse + performance
P10 CI governance
P11 Infrastructure governance
P12 Final certification
```

## Phase 0 exit criteria

- `main` baseline is fixed and recorded.
- #445 remains closed/unmerged and is treated only as a change source.
- Every one of the 46 changed files has a target phase and action.
- No #445 implementation is copied blindly.
- Phase 1 can be built as an independent PR from `main`.

## Explicit non-goals for Phase 0

- Do not change `main`.
- Do not reopen or merge #445.
- Do not introduce AdSense changes onto the Phase 0 branch.
- Do not attempt the canonical-origin rewrite before the decomposition is reviewed.
