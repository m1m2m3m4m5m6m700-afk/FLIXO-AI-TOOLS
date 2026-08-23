import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'src/config/tools.ts');
const routesDir = path.join(root, 'src/routes');

function parseRegistry(source) {
  const entries = [];
  const entryPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?path:\s*'([^']+)'[\s\S]*?description:\s*'[^']*',[\s\S]*?isReady:\s*(true|false)(?:,[\s\S]*?aliases:\s*\[([^\]]*)\])?[\s\S]*?\},/g;
  for (const match of source.matchAll(entryPattern)) {
    const aliases = (match[4] ?? '')
      .match(/'([^']+)'/g)
      ?.map((value) => value.slice(1, -1)) ?? [];
    entries.push({ id: match[1], path: match[2], isReady: match[3] === 'true', aliases });
  }
  assert.ok(entries.length > 0, 'No tool entries found in TOOLS_REGISTRY.');
  return entries;
}

function collectRoutePaths(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => path.join(dir, entry.name));

  const routes = new Set();
  const routeLiteral = /['"](\/(?:[a-z]{2}\/)?[a-z0-9][a-z0-9/_-]*)['"]/gi;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(routeLiteral)) {
      routes.add(match[1]);
    }
  }
  return routes;
}

const registry = parseRegistry(fs.readFileSync(registryPath, 'utf8'));
const registryPaths = new Map();
const registryAliases = new Map();
for (const tool of registry) {
  assert.equal(registryPaths.has(tool.path), false, `duplicate registry path: ${tool.path}`);
  registryPaths.set(tool.path, tool);
  for (const alias of tool.aliases) {
    assert.equal(registryAliases.has(alias), false, `duplicate registry alias: ${alias}`);
    assert.notEqual(alias, tool.path, `alias duplicates canonical path: ${alias}`);
    registryAliases.set(alias, tool);
  }
}

const routePaths = collectRoutePaths(routesDir);
const orphanRoutes = [...routePaths]
  .filter((route) => !registryPaths.has(route) && !registryAliases.has(route) && !route.startsWith('/$'))
  .sort();
assert.deepEqual(orphanRoutes, [], `Routes missing from TOOLS_REGISTRY: ${orphanRoutes.join(', ')}`);

for (const tool of registry) {
  if (tool.isReady) {
    assert.ok(routePaths.has(tool.path), `ready tool has no concrete route: ${tool.id} -> ${tool.path}`);
  } else {
    assert.equal(routePaths.has(tool.path), false, `non-ready tool has a public route: ${tool.id} -> ${tool.path}`);
  }
  for (const alias of tool.aliases) {
    assert.ok(tool.isReady, `non-ready tool cannot expose an alias: ${tool.id} -> ${alias}`);
    assert.ok(routePaths.has(alias), `registered alias has no route: ${tool.id} -> ${alias}`);
  }
}

console.log(`router/registry contract passed: ${registry.length} tools, ${routePaths.size} concrete routes, ${registryAliases.size} aliases`);
