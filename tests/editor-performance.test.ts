import test from 'node:test';
import assert from 'node:assert/strict';
import { assertResourceBudget, enumerateTiles, estimateRgbaBytes } from '../src/lib/editor/performance/index.ts';

test('enforces bounded pixel and byte budgets', () => {
  assert.equal(assertResourceBudget(100, 100, estimateRgbaBytes(100, 100)), true);
  assert.throws(() => assertResourceBudget(10_000, 10_000, 400_000_000), /RESOURCE_PIXEL_BUDGET_EXCEEDED/);
});

test('enumerates edge tiles without exceeding bounds', () => {
  const tiles = enumerateTiles(1025, 513, 512);
  assert.equal(tiles.length, 6);
  assert.deepEqual(tiles.at(-1), { x: 1024, y: 512, width: 1, height: 1 });
});
