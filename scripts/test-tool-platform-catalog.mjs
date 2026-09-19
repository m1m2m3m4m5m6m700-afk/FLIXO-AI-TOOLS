#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createToolCatalog } from '../src/config/tool-platform/catalog.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { getToolDefinition } from '../src/config/canonical-tool-definition.ts';

const component = {};
const source = Object.freeze([
  { id: 'a', title: 'A', path: '/en/a', description: 'A', category: 'Images', isReady: true, component, executionMode: 'LOCAL' },
  { id: 'b', title: 'B', path: '/en/b', description: 'B', category: 'Images', isReady: false, aliases: ['/legacy/b'], component, executionMode: 'CLOUD' },
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
assert.equal(catalog.byId.get('a')?.executionMode, 'LOCAL');
assert.equal(catalog.byId.get('b')?.execution, 'remote');
assert.equal(catalog.byId.get('b')?.executionMode, 'CLOUD');
assert.deepEqual(catalog.byId.get('a')?.contracts, ['structural', 'runtime', 'artifact']);

const canonicalLocal = getToolDefinition('image-compressor');
const managedLocal = TOOL_CATALOG.byId.get('image-compressor');
assert.ok(canonicalLocal && managedLocal);
assert.equal(managedLocal.executionMode, canonicalLocal.executionMode);
assert.equal(managedLocal.execution, 'browser-local');

const canonicalCloud = getToolDefinition('ai-image-generator');
const managedCloud = TOOL_CATALOG.byId.get('ai-image-generator');
assert.ok(canonicalCloud && managedCloud);
assert.equal(managedCloud.executionMode, canonicalCloud.executionMode);
assert.equal(managedCloud.execution, 'remote');

assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'duplicate' }, { ...source[0], id: 'duplicate' }]),
  /Duplicate managed tool id/,
);
assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'c' }, { ...source[0], id: 'd', path: '/en/a' }]),
  /Duplicate managed tool path/,
);
assert.throws(
  () => createToolCatalog([{ ...source[0], id: 'c', aliases: ['/en/a'] }]),
  /Duplicate managed tool route/,
);
assert.throws(
  () => createToolCatalog([
    { ...source[0], id: 'c', path: '/en/c', aliases: ['/en/d'] },
    { ...source[0], id: 'd', path: '/en/d' },
  ]),
  /Duplicate managed tool route/,
);
assert.throws(
  () => createToolCatalog([
    { ...source[0], id: 'c', path: '/en/c' },
    { ...source[0], id: 'd', path: '/en/d', aliases: ['/en/c'] },
  ]),
  /Duplicate managed tool route/,
);

console.log('Tool Platform catalog: PASS');
