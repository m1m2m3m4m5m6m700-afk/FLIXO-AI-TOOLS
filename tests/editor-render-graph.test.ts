import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderGraph, topologicalOrder } from '../src/lib/editor/render/index.ts';

const node = (id: string, dependencies: readonly string[] = []) => ({
  id,
  operation: id,
  dependencies,
  backends: ['canvas2d'] as const,
  parameters: {},
});

test('creates deterministic dependency order', () => {
  const graph = createRenderGraph([
    node('output', ['resize']),
    node('resize', ['source']),
    node('source'),
  ], 'output');
  assert.deepEqual(topologicalOrder(graph).map((entry) => entry.id), ['source', 'resize', 'output']);
});

test('rejects render cycles', () => {
  assert.throws(() => createRenderGraph([
    node('a', ['b']),
    node('b', ['a']),
  ], 'a'), /RENDER_GRAPH_CYCLE/);
});
