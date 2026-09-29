# FLIXO Professional Image Engine Architecture

Status: implementation baseline
Authority: existing FLIXO canonical runtime contracts
Scope: browser-first, non-destructive image editing

## Architecture

User Intent -> Visual Goal -> Deterministic Plan -> Document Graph -> Render Graph -> Canonical Local Execution -> Visual Evaluation -> Bounded Refinement -> Export.

The existing capability registry, execution gate, canonical executor, output contracts, and verifier remain the only runtime authorities.

## Document Graph

A Document owns canvas metadata, source assets, layers, groups, masks, selections, metadata, and history. The original source asset is immutable. Edits are represented as commands/operations rather than destructive pixel replacement.

## Layer model

The first contract supports Raster, Adjustment, Mask, Text, Vector, Generated, and Group layers. Every layer has a stable id, parent relation, z-order, visibility, opacity, blend mode, transform, clipping and optional mask reference.

## Rendering

The document is rendered through a deterministic Render Graph. Backends are implementation details selected by a scheduler; the agent never selects a GPU/backend directly. Cache keys must include document/render identity and operation parameters.

## Performance

Large-image work must be resource bounded. Future tile/region scheduling, workers, WASM and WebGPU are separate backend layers. History must not duplicate full-resolution images per step.

## AI boundary

LLM output is an untrusted proposal. Visual goals, plans, commands and evaluator inputs are typed and validated. Execution requires the existing canonical gate. Evaluators consume actual artifacts and contracts, not executor claims alone.

## Scene format

FLIXO's native scene representation is canonical for editable documents. PSD/ORA/RAW are adapters with explicit compatibility/lossiness rules.

## Non-goals

No second registry, executor, verifier, agent runtime, or certification system. No wholesale import of desktop editors. No PSD-as-source-of-truth. No mandatory server processing for browser-local editing.
