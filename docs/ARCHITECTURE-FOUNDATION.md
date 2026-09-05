# FLIXO Tool Platform — Architecture Foundation

This document records the engineering patterns adopted from the proven platform architecture without duplicating existing contracts.

## Registry and tools

`src/config/registry.ts` remains the authoritative tool registry. Tool families are assembled once and validated for unique IDs, unique routes, required titles, components, and canonical `/en/` paths. New tool code belongs under `src/tools/<tool-id>/` and should keep transformation logic independent from UI concerns.

Existing route, localization, SEO, output, and registry contracts remain authoritative. This foundation does not create a second registry or a parallel SEO manifest.

## Dynamic metadata

Route heads and tool SEO already derive from the route/tool model. New routes must continue deriving title, description, robots, canonical, alternate links, Open Graph, and structured metadata from their authoritative route/tool data instead of hard-coding a second metadata source.

## Persistent theme

`src/lib/theme/persistent-theme.ts` owns the browser theme preference contract. The preference is `light | dark | system` and is persisted under `flixo.theme`. `index.html` resolves the preference before React hydration and writes `data-theme` and `color-scheme` to the root element, eliminating the architectural FOUC gap.

The visual palette remains an independent UI concern. Adding a theme state does not imply that every existing hard-coded color must be rewritten in the same change.

## GitHub integration

`src/lib/integrations/github/` is a server-only boundary. Browser code must not hold GitHub credentials or call GitHub directly.

The bounded surface provides:

- authenticated GitHub API access,
- multi-file commit creation through Git blobs, trees, commits, and a fast-forward-only branch update,
- workflow dispatch and workflow-run lookup.

The integration is intentionally generic. Repository-specific automation belongs in a server/API layer and must pass explicit repository, branch, workflow, and file inputs.

## Proof boundary

`Foundation Contract` validates the theme resolution contract and the GitHub commit pipeline with a deterministic fake client. It does not claim live GitHub credentials or live repository mutation as proof.
