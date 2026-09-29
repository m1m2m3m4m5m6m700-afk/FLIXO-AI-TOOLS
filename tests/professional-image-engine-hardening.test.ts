import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/lib/editor/document/index.ts';
import type { DocumentCommand } from '../src/lib/editor/commands';
import { applyTransaction } from '../src/lib/editor/engine/transactions.ts';
import { createSmartAsset, createAssetFingerprint } from '../src/lib/editor/engine/smart-assets.ts';
import { createCoverage, combineCoverage } from '../src/lib/editor/masks/coverage.ts';
import { createMaskGraph, maskGraphOrder } from '../src/lib/editor/masks/graph.ts';
import { createRenderGraph } from '../src/lib/editor/render/graph.ts';
import { createRenderPlan, assertRenderPlanFresh } from '../src/lib/editor/render/plan.ts';

const makeDocument = () => createDocument('hardening-doc', {
  width: 64, height: 64, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
});

const metadataCommand = (id: string, label: string): DocumentCommand => ({
  id,
  label,
  execute: ({ document }) => Object.freeze({ ...document, metadata: Object.freeze({ ...document.metadata, label }) }),
  undo: ({ document }) => document,
  serialize: () => ({ id, label }),
});

test('document transaction is atomic when a later operation fails', () => {
  const source = makeDocument();
  const failing: DocumentCommand = {
    id: 'fail',
    label: 'fail',
    execute: () => { throw new Error('TRANSACTION_FAILURE'); },
    undo: ({ document }) => document,
    serialize: () => ({ id: 'fail' }),
  };
  assert.throws(() => applyTransaction(source, [
    { id: 'op-1', label: 'metadata', command: metadataCommand('op-1', 'changed'), changedLayerIds: [] },
    { id: 'op-2', label: 'fail', command: failing, changedLayerIds: [] },
  ], source.version), /TRANSACTION_FAILURE/);
  assert.equal(source.version, 1);
  assert.deepEqual(source.metadata, {});
});

test('SmartAsset keeps immutable provenance collections and rejects orphan derivatives', () => {
  const asset = { id: 'asset-1', kind: 'source' as const, name: 'a.png', mimeType: 'image/png', width: 64, height: 64 };
  const fingerprint = createAssetFingerprint('a'.repeat(64));
  assert.throws(() => createSmartAsset(asset, fingerprint, {
    kind: 'derived', parentAssetIds: [], operationId: 'op-1',
  }), /DERIVED_ASSET_PARENT_REQUIRED/);
  const parents = ['source-1'];
  const smart = createSmartAsset(asset, fingerprint, { kind: 'derived', parentAssetIds: parents, operationId: 'op-1' });
  parents.push('poisoned');
  assert.deepEqual(smart.provenance.parentAssetIds, ['source-1']);
});

test('MaskGraph fails closed on cycles and preserves dependency order', () => {
  const coverage = createCoverage(2, 2, 1);
  const mask = (id: string) => ({ id, source: 'raster' as const, coverage });
  assert.throws(() => createMaskGraph([
    { id: 'a', mask: mask('a'), inputs: ['b'], operation: 'add' },
    { id: 'b', mask: mask('b'), inputs: ['a'], operation: 'add' },
  ], 'a'), /MASK_GRAPH_CYCLE/);
  const graph = createMaskGraph([
    { id: 'base', mask: mask('base'), inputs: [], operation: null },
    { id: 'overlay', mask: mask('overlay'), inputs: ['base'], operation: 'add' },
  ], 'overlay');
  assert.deepEqual(maskGraphOrder(graph).map((node) => node.id), ['base', 'overlay']);
});

test('mask coverage composition is dimension-safe and bounded', () => {
  const left = createCoverage(2, 2, 0.75);
  const right = createCoverage(2, 2, 0.75);
  const sum = combineCoverage(left, right, 'add');
  assert.equal(sum.values[0], 1);
  assert.throws(() => combineCoverage(left, createCoverage(1, 2), 'add'), /MASK_DIMENSIONS_MISMATCH/);
});

test('RenderPlan rejects stale document or render identities', () => {
  const graph = createRenderGraph([
    { id: 'source', operation: 'source', dependencies: [], backends: ['canvas2d'], parameters: {} },
  ], 'source');
  const plan = createRenderPlan(graph, 3, 7, {
    source: [{ x: 0, y: 0, width: 32, height: 32 }],
  });
  assert.equal(plan.documentVersion, 3);
  assert.equal(plan.renderVersion, 7);
  assert.equal(plan.nodes[0]?.dirtyRegions[0]?.width, 32);
  assert.doesNotThrow(() => assertRenderPlanFresh(plan, 3, 7));
  assert.throws(() => assertRenderPlanFresh(plan, 4, 7), /STALE_RENDER_PLAN/);
});
