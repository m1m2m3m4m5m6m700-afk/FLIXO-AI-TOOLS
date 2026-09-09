#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createToolCatalog } from '../src/config/tool-platform/catalog.ts';

const component = {};
const source = Object.freeze([
  { id: 'a', title: 'A', path: '/en/a', description: 'A', category: 'Images', isReady: true, component },
  { id: 'b', title: 'B', path: '/en/b', description: 'B', category: 'Images', isReady: false, aliases: ['/legacy/b'], component },
]);

const catalog = createToolCatalog(source);
assert.equal(catalog.all.length, 2);
assert.equal(catalog.ready.length, 1);
assert.equal(catalog.byId.get('a')?.id, 'a');
assert.equal(catalog.byPath.get('/en/b')?.id, 'b');
assert.equal(catalog.byAlias.get('/legacy/b')?.id, 'b');
assert.equal(catalog.byId.get('a')?.lifecycle, 'ready');
assert.equal(catalog.byId.get('b')?.lifecycle, 'experimental');
assert.equal(catalog.byId.get('a')?.execution, 'browser-local');
assert.deepEqual(catalog.byId.get('a')?.contracts, ['structural', 'runtime', 'artifact']);

assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'duplicate' }, { ...source[0], id: 'duplicate' }]),
  /Duplicate managed tool id/,
);
assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'c' }, { ...source[0], id: 'd', path: '/en/c' }]),
  /Duplicate managed tool path/,
);
assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'c', aliases: ['/en/a'] }]),
  /Duplicate managed tool route/,
);

console.log('Tool Platform catalog: PASS');
