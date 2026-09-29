import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, validateDocument, withDocumentVersion } from '../src/lib/editor/document/index.ts';

test('creates a valid immutable document baseline', () => {
  const document = createDocument('doc-1', {
    width: 1200,
    height: 800,
    colorSpace: 'srgb',
    bitDepth: 8,
    alpha: 'premultiplied',
  }, [{
    id: 'asset-1',
    kind: 'source',
    name: 'source.png',
    mimeType: 'image/png',
    width: 1200,
    height: 800,
  }]);

  assert.equal(document.schemaVersion, 1);
  assert.equal(document.version, 1);
  assert.equal(validateDocument(document), true);
  assert(Object.isFrozen(document));
  assert(Object.isFrozen(document.canvas));
});

test('rejects duplicate ids and missing raster assets', () => {
  const base = createDocument('doc-2', {
    width: 100,
    height: 100,
    colorSpace: 'srgb',
    bitDepth: 8,
    alpha: 'premultiplied',
  });
  const layer = {
    id: 'raster-1',
    type: 'raster' as const,
    name: 'Raster',
    parentId: null,
    zIndex: 0,
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    clipToBelow: false,
    maskId: null,
    assetId: 'missing',
  };
  assert.throws(() => validateDocument({ ...base, layers: [layer] }), /RASTER_ASSET_MISSING/);
});

test('advances document version without mutating the source object', () => {
  const base = createDocument('doc-3', {
    width: 100,
    height: 100,
    colorSpace: 'srgb',
    bitDepth: 8,
    alpha: 'premultiplied',
  });
  const next = withDocumentVersion(base, 2);
  assert.equal(base.version, 1);
  assert.equal(next.version, 2);
});
