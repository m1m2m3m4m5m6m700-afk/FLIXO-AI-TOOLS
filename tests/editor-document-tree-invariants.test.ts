import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, validateDocument } from '../src/lib/editor/document/index.ts';

const baseDocument = () => createDocument('tree-doc', {
  width: 100, height: 100, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
});

const raster = (id: string, parentId: string | null = null) => ({
  id, type: 'raster' as const, name: id, parentId, zIndex: 0, visible: true, opacity: 1,
  blendMode: 'normal' as const, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  clipToBelow: false, maskId: null, assetId: 'asset-1',
});

const group = (id: string, childIds: readonly string[], parentId: string | null = null) => ({
  id, type: 'group' as const, name: id, parentId, zIndex: 0, visible: true, opacity: 1,
  blendMode: 'normal' as const, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  clipToBelow: false, maskId: null, childIds,
});

const mask = (id: string, maskId: string | null = null) => ({
  id, type: 'mask' as const, name: id, parentId: null, zIndex: 0, visible: true, opacity: 1,
  blendMode: 'normal' as const, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  clipToBelow: false, maskId, source: 'raster' as const,
});

const withAsset = (layers: readonly object[]) => ({
  ...baseDocument(),
  assets: [{ id: 'asset-1', kind: 'source' as const, name: 'a.png', mimeType: 'image/png', width: 100, height: 100 }],
  layers,
});

test('accepts a consistent group parent/child relation', () => {
  assert.equal(validateDocument(withAsset([group('g', ['r']), raster('r', 'g')])), true);
});

test('rejects non-group parents and inconsistent group children', () => {
  assert.throws(() => validateDocument(withAsset([raster('root'), raster('child', 'root')])), /LAYER_PARENT_NOT_GROUP/);
  assert.throws(() => validateDocument(withAsset([group('g', ['r']), raster('r')])), /GROUP_CHILD_PARENT_MISMATCH/);
  assert.throws(() => validateDocument(withAsset([group('g', ['missing'])])), /GROUP_CHILD_MISSING/);
});

test('rejects parent cycles and self-reference', () => {
  assert.throws(() => validateDocument(withAsset([group('a', [], 'b'), group('b', [], 'a')])), /LAYER_PARENT_CYCLE/);
  assert.throws(() => validateDocument(withAsset([mask('m', 'm')])), /LAYER_SELF_MASK/);
});
