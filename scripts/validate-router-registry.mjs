import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'src/config/tools.ts');
const routesDir = path.join(root, 'src/routes');

function parseRegistry(source) {
  const entries = [];
  const entryPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?path:\s*'([^']+)'[\s\S]*?description:\s*'[^']*',[\s\S]*?isReady:\s*(true|false)[\s\S]*?\},/g;
  for (const match of source.matchAll(entryPattern)) {
    entries.push({ id: match[1], path: match[2], isReady: match[3] === 'true' });
  }
  assert.ok(entries.length > 0, 'No tool entries found in TOOLS_REGISTRY.');
  return entries;
}

function collectRoutePaths(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => path.join(dir, entry.name));

  const routes = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/path:\s*'([^']+)'/g)) {
      const route = match[1];
      if (/^\/(?:[a-z]{2}\/)?[^$].+/.test(route)) routes.add(route);
    }
  }
  return routes;
}

const registry = parseRegistry(fs.readFileSync(registryPath, 'utf8'));
const registryPaths = new Map(registry.map((tool) => [tool.path, tool]));
const routePaths = collectRoutePaths(routesDir);

const orphanRoutes = [...routePaths]
  .filter((route) => !registryPaths.has(route) && !route.startsWith('/$'))
  .sort();
assert.deepEqual(orphanRoutes, [], `Routes missing from TOOLS_REGISTRY: ${orphanRoutes.join(', ')}`);

for (const tool of registry) {
  if (tool.isReady) {
    assert.ok(routePaths.has(tool.path), `ready tool has no concrete route: ${tool.id} -> ${tool.path}`);
  } else {
    assert.equal(routePaths.has(tool.path), false, `non-ready tool has a public route: ${tool.id} -> ${tool.path}`);
  }
}

console.log(`router/registry contract passed: ${registry.length} tools, ${routePaths.size} concrete routes`);
