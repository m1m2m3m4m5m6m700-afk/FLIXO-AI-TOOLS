# FLIXO Architecture Boundaries

## Purpose

This document defines the dependency direction for the repository while the monorepo migration is performed incrementally.

## Application boundaries

- `src/` is the current primary Vite application.
- `apps/agent-editor/` is a separate Next.js application.
- Neither application may import implementation details from the other.
- Shared runtime/domain code must move behind explicit package boundaries before cross-application reuse is introduced.

## Agent ownership

The canonical Agent domain is `packages/agent-runtime/`. The legacy `src/lib/agent/` surface is migration-only and receives no new shared runtime features.

`apps/agent-editor/lib/agent/` is application-local orchestration code and must not become a second canonical Agent runtime.

During migration:
1. New shared Agent contracts belong in `packages/contracts/`.
2. Shared Agent runtime belongs in `packages/agent-runtime/`.
3. New shared Agent state/profile/discovery/task lifecycle code must not be added to `src/lib/agent/`.
3. Application adapters remain inside their owning app.
4. Legacy modules are deleted only after import consumers and tests have been migrated.

## Dependency direction

```
apps/*  -> packages/*
packages/* -> packages/* (only through declared contracts)
apps/*  -X-> other apps
packages/* -X-> apps/*
```

The `-X->` edges are prohibited.

## Migration gates

A migration step is complete only when:
- typecheck passes;
- lint passes;
- unit/core tests pass;
- agent-editor typecheck/build pass;
- browser tests pass when the changed surface requires them;
- no new cross-app imports are introduced.

This file is an architectural contract, not a claim that the final package extraction is already complete.
