# FLIXO MVP Scope Freeze

**Status:** SCOPE-FROZEN / VERIFICATION REQUIRED  
**Execution lane:** `execution`

## Frozen MVP executable set

The first FLIXO MVP executable slice is frozen to exactly:

- `background-remover`
- `image-upscaler`
- `image-cropper`
- `image-compressor`
- `image-converter`
- `image-effects`

Each remains governed by the canonical capability registry, parameter schema, executor binding, output verification/contract, safety limits, and regression coverage.

Tools that are recognized or plannable but not executable through the local canonical pipeline remain **Post-MVP**. They are not blockers unless a direct dependency on this six-capability journey is proven.

## Recovery boundary

The MVP recovery contract is **bounded canonical retry + output verification + fail-closed terminal handling**.

Semantic **Replan** is explicitly **Post-MVP**. The current policy's `replanOnFailure=false` is therefore an intentional MVP scope decision, not a hidden blocker. Replan returns to the MVP gate only if a future product decision establishes a direct MVP dependency and a safe alternate-plan execution path.

## Natural-language boundary

Representative English and Arabic requests, including compound requests, must map safely to the frozen executable set. The acceptance matrix is part of the existing `test:ai-planner` unit gate in `scripts/test-ai-planner.mjs`.

This document freezes scope only; it does not certify MVP. Fresh exact-SHA verification, browser proof, production proof, and final Certification remain mandatory.
