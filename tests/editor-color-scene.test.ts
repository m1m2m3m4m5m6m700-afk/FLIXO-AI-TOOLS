import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/lib/editor/document/index.ts';
import { DEFAULT_COLOR_PIPELINE, validateColorPipeline } from '../src/lib/editor/color/index.ts';
import { parseScene, serializeScene } from '../src/lib/editor/scene.ts';

const document = createDocument('scene-doc', {
  width: 10, height: 10, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
});

test('validates the initial color pipeline contract', () => {
  assert.equal(validateColorPipeline(DEFAULT_COLOR_PIPELINE), true);
});

test('FLIXO scene round-trips document identity', () => {
  const scene = { format: 'flixo-scene' as const, version: 1 as const, document, agentTrace: { intent: 'test' } };
  assert.equal(parseScene(serializeScene(scene)).document.id, document.id);
});
