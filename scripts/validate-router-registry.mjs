import assert from 'node:assert/strict';

const { TOOLS_REGISTRY } = await import('../src/config/tools.ts');

assert.ok(Array.isArray(TOOLS_REGISTRY) && TOOLS_REGISTRY.length > 0, 'TOOLS_REGISTRY is empty or invalid.');

const canonicalPaths = new Map();
const aliases = new Map();

for (const tool of TOOLS_REGISTRY) {
  assert.ok(tool.id, 'every tool must have an id');
  assert.ok(tool.path.startsWith('/'), `invalid canonical path for ${tool.id}: ${tool.path}`);
  assert.equal(canonicalPaths.has(tool.path), false, `duplicate registry path: ${tool.path}`);
  canonicalPaths.set(tool.path, tool);

  for (const alias of tool.aliases ?? []) {
    assert.ok(alias.startsWith('/'), `invalid alias for ${tool.id}: ${alias}`);
    assert.equal(aliases.has(alias), false, `duplicate registry alias: ${alias}`);
    assert.equal(canonicalPaths.has(alias), false, `alias duplicates canonical path: ${alias}`);
    aliases.set(alias, tool);
    assert.equal(tool.isReady, true, `non-ready tool cannot expose a route alias: ${tool.id} -> ${alias}`);
  }
}

const readyTools = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const nonReadyTools = TOOLS_REGISTRY.filter((tool) => !tool.isReady);

assert.equal(
  nonReadyTools.filter((tool) => tool.id === 'photo-colorizer').length,
  1,
  'photo-colorizer readiness contract is missing.',
);

assert.equal(
  nonReadyTools.every((tool) => !aliasesHasTool(aliases, tool)),
  true,
  'non-ready tools must not expose aliases.',
);

function aliasesHasTool(aliasMap, tool) {
  for (const owner of aliasMap.values()) {
    if (owner === tool) return true;
  }
  return false;
}

console.log('router/registry contract passed');
console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
console.log(`ready tools: ${readyTools.length}`);
console.log(`non-ready tools: ${nonReadyTools.length}`);
console.log(`canonical paths: ${canonicalPaths.size}`);
console.log(`aliases: ${aliases.size}`);
console.log('route generation source: TOOLS_REGISTRY');
