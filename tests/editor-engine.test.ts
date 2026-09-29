import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/lib/editor/document/index.ts';
import { createDocumentEngine } from '../src/lib/editor/engine/index.ts';

const base = () => createDocument('engine-doc', {
  width: 100,
  height: 100,
  colorSpace: 'srgb',
  bitDepth: 8,
  alpha: 'premultiplied',
});

const raster = (id: string, assetId: string, zIndex = 0) => ({
  id, type: 'raster' as const, name: id, parentId: null, zIndex, visible: true, opacity: 1,
  blendMode: 'normal' as const, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  clipToBelow: false, maskId: null, assetId,
});

test('engine commits immutable document transactions with optimistic versioning', () => {
  const document = createDocument('engine-doc', {
    width: 100, height: 100, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
  }, [{ id: 'asset-1', kind: 'source', name: 'a.png', mimeType: 'image/png', width: 100, height: 100 }]);
  const engine = createDocumentEngine(document);
  const first = engine.addLayer(raster('layer-1', 'asset-1'), 1);
  assert.equal(first.version, 2);
  assert.equal(engine.snapshot().document.layers.length, 1);
  assert.throws(() => engine.updateLayer('layer-1', { opacity: 0.5 }, 1), /STALE_DOCUMENT_VERSION/);
  const second = engine.updateLayer('layer-1', { opacity: 0.5 }, 2);
  assert.equal(second.version, 3);
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 0.5);
});

test('engine preserves history branches and supports undo/redo', () => {
  const document = createDocument('engine-doc', {
    width: 100, height: 100, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
  }, [{ id: 'asset-1', kind: 'source', name: 'a.png', mimeType: 'image/png', width: 100, height: 100 }]);
  const engine = createDocumentEngine(document);
  engine.addLayer(raster('layer-1', 'asset-1'), 1);
  engine.updateLayer('layer-1', { opacity: 0.4 }, 2);
  assert.equal(engine.snapshot().canUndo, true);
  engine.undo();
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 1);
  engine.redo();
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 0.4);
});

test('engine rejects invalid layer mutations before commit', () => {
  const document = createDocument('engine-doc', {
    width: 100, height: 100, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
  }, [{ id: 'asset-1', kind: 'source', name: 'a.png', mimeType: 'image/png', width: 100, height: 100 }]);
  const engine = createDocumentEngine(document);
  assert.throws(() => engine.addLayer(raster('layer-1', 'asset-1'), 99), /STALE_DOCUMENT_VERSION/);
  assert.throws(() => engine.addLayer({ ...raster('layer-1', 'asset-1'), opacity: 2 }, 1), /LAYER_OPACITY_INVALID/);
  assert.equal(engine.snapshot().document.layers.length, 0);
});
