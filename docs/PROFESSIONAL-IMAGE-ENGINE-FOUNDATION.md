# Professional Image Engine Foundation

Status: execution candidate.

The engine is document-centric and non-destructive. The existing canonical document model remains the source of truth for canvas, assets, layers, masks, and metadata.

## Invariants

- Mutations are validated before commit.
- Every mutation carries an expected engine revision.
- A stale expected revision fails closed with `STALE_DOCUMENT_VERSION`.
- Engine revisions are monotonic, including undo and redo navigation.
- Layer mutations are immutable and preserve document identity/version semantics.
- Operation receipts expose the committed revision and changed layer IDs.
- History navigation never reuses an earlier engine revision.

## Boundary

This foundation deliberately does not claim tile scheduling, GPU/WASM execution, ICC workflows, advanced MaskGraph composition, or agent closed-loop verification. Those are subsequent capabilities and must integrate through the same document-engine boundary.

Regression coverage lives in `tests/editor-engine.test.ts`.
