#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createToolCatalog } from '../src/config/tool-platform/catalog.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { getToolDefinition, TOOL_DEFINITIONS } from '../src/config/canonical-tool-definition.ts';
import { assertExecutorCoverage } from '../src/lib/workflows/executor-registry.ts';
import { assertReadyToolsHaveOutputContracts } from '../src/lib/contracts/tool-output-contracts.ts';

const component = {};
const profile = (lifecycle, execution, executorId, outputContractId) => ({ lifecycle, execution, contracts: ['structural', 'runtime', 'artifact'], executorId, outputContractId });
const source = Object.freeze([
  { id: 'a', family: 'image', title: 'A', path: '/en/a', description: 'A', category: 'Images', isReady: true, aliases: [], component, capability: { state: 'EXECUTABLE', intents: ['a'] }, executionMode: 'LOCAL', parameterSchema: {}, safetyLimits: { maxPixels: 1, maxFileSizeBytes: 1, timeoutMs: 1 }, verifier: async () => true, recovery: { maxAttempts: 3, replanOnFailure: false }, operational: profile('ready', 'browser-local', 'a', 'a'), localization: { titleKey: 'tool.a.title', descriptionKey: 'tool.a.description' }, seo: { title: 'A', description: 'A', robots: 'index,follow,max-image-preview:large' } },
  { id: 'b', family: 'image', title: 'B', path: '/en/b', description: 'B', category: 'Images', isReady: false, aliases: ['/legacy/b'], component, capability: { state: 'UNAVAILABLE', intents: [] }, executionMode: 'CLOUD', parameterSchema: {}, safetyLimits: { maxPixels: 1, maxFileSizeBytes: 1, timeoutMs: 1 }, verifier: async () => true, recovery: { maxAttempts: 0, replanOnFailure: false }, operational: profile('experimental', 'remote', null, null), localization: { titleKey: 'tool.b.title', descriptionKey: 'tool.b.description' }, seo: { title: 'B', description: 'B', robots: 'index,follow,max-image-preview:large' } },
]);

const catalog = createToolCatalog(source);
assert.equal(catalog.all.length, 2);
assert.equal(catalog.ready.length, 1);
assert.equal(catalog.byId.get('a')?.id, 'a');
assert.equal(catalog.byPath.get('/en/b')?.id, 'b');
assert.equal(catalog.byAlias.get('/legacy/b')?.id, 'b');
assert.equal(catalog.byId.get('a')?.operational.lifecycle, 'ready');
assert.equal(catalog.byId.get('b')?.operational.lifecycle, 'experimental');
assert.equal(catalog.byId.get('a')?.operational.execution, 'browser-local');
assert.equal(catalog.byId.get('a')?.executionMode, 'LOCAL');
assert.equal(catalog.byId.get('b')?.operational.execution, 'remote');
assert.equal(catalog.byId.get('b')?.executionMode, 'CLOUD');
assert.deepEqual(catalog.byId.get('a')?.operational.contracts, ['structural', 'runtime', 'artifact']);
assert.match(catalog.fingerprint, /^[a-f0-9]{64}$/);
assert.equal(catalog.fingerprint, createToolCatalog(source).fingerprint);
const catalogSource = fs.readFileSync('src/config/tool-platform/catalog.ts', 'utf8');
assert.doesNotMatch(catalogSource, /from ['"]node:crypto['"]/u);
assert.match(catalogSource, /function sha256Hex/iu);
const reordered = createToolCatalog([source[1], source[0]]);
assert.equal(reordered.fingerprint, catalog.fingerprint);

const canonicalLocal = getToolDefinition('image-compressor');
const managedLocal = TOOL_CATALOG.byId.get('image-compressor');
assert.ok(canonicalLocal && managedLocal);
assert.equal(managedLocal.executionMode, canonicalLocal.executionMode);
assert.equal(managedLocal.operational.execution, 'browser-local');

const canonicalCloud = getToolDefinition('ai-image-generator');
const managedCloud = TOOL_CATALOG.byId.get('ai-image-generator');
assert.ok(canonicalCloud && managedCloud);
assert.equal(managedCloud.executionMode, canonicalCloud.executionMode);
assert.equal(managedCloud.operational.execution, 'remote');
assert.equal(managedLocal.requirements.network, false);
assert.equal(managedCloud.requirements.network, true);

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


assertExecutorCoverage(TOOL_DEFINITIONS);
assertReadyToolsHaveOutputContracts();
const canonicalCatalog = createToolCatalog(TOOL_DEFINITIONS);
assert.equal(canonicalCatalog.byId.size, TOOL_DEFINITIONS.length);
assert.equal(canonicalCatalog.byPath.size, TOOL_DEFINITIONS.length);
assert.equal(canonicalCatalog.ready.length, TOOL_DEFINITIONS.filter((tool) => tool.isReady).length);
assert.deepEqual(canonicalCatalog.all.map((tool) => tool.id), [...TOOL_DEFINITIONS].map((tool) => tool.id).sort((a, b) => a.localeCompare(b)));

console.log('Tool Platform canonical catalog + deterministic ordering: PASS');
