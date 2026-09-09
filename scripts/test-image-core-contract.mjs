#!/usr/bin/env node
import assert from 'node:assert/strict';
import { addLayer, createImageDocument, removeLayer, updateLayer } from '../src/image-core/document.ts';
import { ImageHistory } from '../src/image-core/history.ts';
import { createImageRenderer } from '../src/image-core/render.ts';

const original = createImageDocument({ id: 'doc-1', width: 800, height: 600 });
assert.deepEqual(original, {
  id: 'doc-1',
  width: 800,
  height: 600,
  colorSpace: 'srgb',
  background: 'transparent',
  layers: [],
  selections: [],
  metadata: {},
});

assert.throws(() => createImageDocument({ id: 'bad-width', width: 0, height: 10 }), /positive integer/);
assert.throws(() => createImageDocument({ id: 'bad-height', width: 10, height: 1.5 }), /positive integer/);

const layer = {
  id: 'layer-1',
  type: 'raster',
  name: 'Source',
  visible: true,
  opacity: 1,
  blendMode: 'normal',
};
const withLayer = addLayer(original, layer);
assert.equal(original.layers.length, 0, 'addLayer must not mutate the source document');
assert.equal(withLayer.layers.length, 1);
assert.deepEqual(withLayer.layers[0].transform, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

const updated = updateLayer(withLayer, 'layer-1', { opacity: 0.5, name: 'Edited' });
assert.equal(withLayer.layers[0].opacity, 1, 'updateLayer must not mutate the source document');
assert.equal(updated.layers[0].opacity, 0.5);
assert.equal(updated.layers[0].name, 'Edited');
assert.equal(updated.layers[0].id, 'layer-1');

const removed = removeLayer(updated, 'layer-1');
assert.equal(updated.layers.length, 1, 'removeLayer must not mutate the source document');
assert.equal(removed.layers.length, 0);

const history = new ImageHistory();
const addCommand = {
  type: 'layer.add',
  execute(document) { return addLayer(document, { ...layer, name: 'History Layer' }); },
  undo(document) { return removeLayer(document, 'layer-1'); },
};
const edited = history.execute(original, addCommand);
assert.equal(history.size, 1);
assert.equal(history.canUndo, true);
assert.equal(history.canRedo, false);
assert.equal(edited.layers.length, 1);

const undone = history.undo(edited);
assert.equal(undone.layers.length, 0);
assert.equal(history.canUndo, false);
assert.equal(history.canRedo, true);

const redone = history.redo(undone);
assert.equal(redone.layers.length, 1);
assert.equal(history.canUndo, true);
assert.equal(history.canRedo, false);

const renderer = createImageRenderer();
assert.equal(renderer.backend, 'canvas2d');
assert.throws(() => createImageRenderer('webgl'), /renderer is not implemented/);
assert.throws(() => createImageRenderer('webgpu'), /renderer is not implemented/);

history.clear();
assert.equal(history.size, 0);
assert.equal(history.canUndo, false);
assert.equal(history.canRedo, false);

console.log('Image Core contract: PASS');
