import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS } from '../src/config/canonical-tool-definition.ts';
import { createToolCatalog } from '../src/config/tool-platform/catalog.ts';

const base = TOOL_DEFINITIONS.find((tool) => tool.id === 'image-compressor');
assert.ok(base);

const fixture = {
  ...base,
  id: 'fixture-auto-discovered-tool',
  title: 'Fixture Auto Discovery',
  path: '/en/fixture-auto-discovered-tool',
  aliases: ['/legacy/fixture-auto-discovered-tool'],
  capability: { state: 'EXECUTABLE', intents: ['fixture auto discovery'] },
  operational: {
    lifecycle: 'ready',
    execution: 'browser-local',
    contracts: ['structural', 'runtime', 'artifact'],
    executorId: 'image-compressor',
    outputContractId: 'image-compressor',
  },
};

const catalog = createToolCatalog([...TOOL_DEFINITIONS, fixture]);
assert.equal(catalog.byId.get(fixture.id)?.id, fixture.id);
assert.equal(catalog.byPath.get(fixture.path)?.id, fixture.id);
assert.equal(catalog.byAlias.get(fixture.aliases[0])?.id, fixture.id);
assert.deepEqual(catalog.all.map((tool) => tool.id), [...catalog.all].map((tool) => tool.id).sort((a, b) => a.localeCompare(b)));

const canonicalIds = new Set(TOOL_DEFINITIONS.map((tool) => tool.id));
assert.equal(canonicalIds.has(fixture.id), false);
console.log('Tool Platform auto-discovery fixture: PASS');
