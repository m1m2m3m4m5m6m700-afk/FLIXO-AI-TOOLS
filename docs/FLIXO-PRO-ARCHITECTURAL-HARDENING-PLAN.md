# FLIXO — Professional Image Engine Architectural Hardening Plan

## Purpose
رفع محرك تحرير الصور من foundation إلى معمارية AI-native احترافية، فوق Document Graph وRender Graph والعقود canonical الحالية، دون Registry أو Executor أو Authority ثانية.

## Architectural target
Intent → Visual Goal → Perception → Spatial Constraints → Deterministic Plan → Transaction → Document Graph → Render Plan → Tile/Region Graph → Resource Guard → CPU/WASM/WebGPU → Artifact → Structural/Pixel/Perceptual/Semantic Evaluation → bounded Replan → Commit/Rollback → FLIXO Scene → Export.

## Hardening workstreams
### H1 — Document and Asset Core
- SmartAsset/source preservation/fingerprint/provenance.
- First-class LayerTree, Group, MaskGraph, SelectionGraph, Effect/Transform graph.
- Non-destructive operations and copy-on-write snapshots.
- Document version invariants and immutable source identity.

### H2 — Transaction and History Integrity
- Atomic DocumentTransaction with commit/rollback.
- Command → Transaction → DocumentVersion → HistoryDAG.
- Branch/checkout/replay semantics.
- No full-document clone per history step.
- Stale command/render results must never overwrite newer document versions.

### H3 — Mask and Selection Graph
- Raster/vector/brush/gradient/radial/polygon/semantic/AI masks.
- ADD/SUBTRACT/INTERSECT/MULTIPLY/INVERT/FEATHER/BLUR/EXPAND/CONTRACT.
- First-class selections with raster/vector/semantic representations.
- Protected-region constraints for AI editing.

### H4 — Render and Compute Engine
- RenderPlan over RenderGraph.
- Dirty-region analysis and tile dependency graph.
- Tile cache, mip/proxy pyramid, partial rendering.
- Explicit CPUReference, WASM, WebGL and WebGPU backends.
- CPU reference output is semantic baseline for backend equivalence tests.
- GPU device-loss recovery and deterministic CPU/WASM fallback.
- Worker jobs carry documentVersion/renderVersion/inputFingerprint and AbortSignal.

### H5 — Resource Safety
- Pixel, byte, dimension, tile, worker, concurrency, output-size and time budgets.
- Decoder isolation and untrusted-file limits.
- No unbounded full-resolution intermediate duplication.
- Cancellation and timeout must leave document state valid.

### H6 — Color and Compositing
- Source profile → decode → working color space → linear-light operations → gamut/tone transform → display/export.
- Explicit sRGB/Display-P3/Adobe RGB contracts and ICC boundary.
- Straight/premultiplied alpha contract.
- Golden tests for transparency, blend, resize and color transforms.

### H7 — I/O and Metadata
- Capability matrix per format: read/write/alpha/ICC/layers/metadata/animation.
- FLIXO Scene remains canonical editable representation.
- External formats are adapters with explicit lossiness.
- Metadata policy: preserve/strip/sanitize/transform.
- GPS and sensitive metadata never become automatic Agent context.

### H8 — AI Visual Editing
- Visual Perception as advisory input.
- Visual Goal + target/protected regions + preservation constraints.
- Deterministic document-command planner using canonical capabilities only.
- Plan identity must equal executed plan identity.
- Evaluator combines structural, pixel, perceptual and semantic evidence.
- Bounded refinement with attempt/time/mutation/scope limits.

### H9 — Provenance and Explainability
- AgentTrace linked to document versions, transaction IDs, render IDs and verification receipts.
- Explainable Edit Map: changed regions, protected regions, operation and verification evidence.
- No secrets or raw media bytes in traces.

### H10 — Verification Corpus
- Golden-image corpus covering portraits, landscapes, transparency, gradients, text, masks, composites, high resolution and color-managed assets.
- Cross-backend equivalence tests.
- Race/stale-render tests.
- Memory/resource exhaustion tests.
- Browser no-byte-egress tests.
- Artifact-level visual verification.

## Execution rules
- Implement only on execution and promote through normal execution → main review.
- Reuse canonical registry, execution gate, executor and verifier.
- Inspect exact SHA before mutation and invalidate prior evidence after every mutation.
- No fake support for WebGPU, PSD, ORA, RAW or color profiles; unsupported capabilities remain explicit.
- No feature is 100/100 from source inspection alone; require targeted tests and applicable browser/CI/security evidence.

## Acceptance gate
A workstream is PASS only with implementation + deterministic tests + applicable browser/security/performance evidence on the same candidate lineage. Deferred work must be explicitly documented with dependency and scope authority.