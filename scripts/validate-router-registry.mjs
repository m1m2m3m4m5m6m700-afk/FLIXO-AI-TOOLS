import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const routesDir = path.join(root, 'src/routes');

const { TOOLS_REGISTRY } = await import('../src/config/tools.ts');

assert.ok(Array.isArray(TOOLS_REGISTRY) && TOOLS_REGISTRY.length > 0, 'TOOLS_REGISTRY is empty or invalid.');

function propertyName(node) {
  if (!node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function extractRoutePaths(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = new Set();

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createRoute') {
      const [argument] = node.arguments;
      if (argument && ts.isObjectLiteralExpression(argument)) {
        const pathProperty = argument.properties.find(
          (property) => ts.isPropertyAssignment(property) && propertyName(property) === 'path',
        );
        if (pathProperty && ts.isPropertyAssignment(pathProperty) && ts.isStringLiteral(pathProperty.initializer)) {
          routes.add(pathProperty.initializer.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return routes;
}

function listRouteFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listRouteFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.tsx')) files.push(fullPath);
  }
  return files;
}

const canonicalPaths = new Map();
const aliases = new Map();

for (const tool of TOOLS_REGISTRY) {
  assert.ok(tool.id, 'every tool must have an id');
  assert.ok(tool.path.startsWith('/'), `invalid canonical path for ${tool.id}: ${tool.path}`);
  assert.equal(canonicalPaths.has(tool.path), false, `duplicate registry path: ${tool.path}`);
  assert.equal(aliases.has(tool.path), false, `canonical path is already an alias: ${tool.id} -> ${tool.path}`);
  canonicalPaths.set(tool.path, tool);

  for (const alias of tool.aliases ?? []) {
    assert.ok(alias.startsWith('/'), `invalid alias for ${tool.id}: ${alias}`);
    assert.equal(aliases.has(alias), false, `duplicate registry alias: ${alias}`);
    assert.equal(canonicalPaths.has(alias), false, `alias duplicates canonical path: ${tool.id} -> ${alias}`);
    assert.equal(tool.isReady, true, `non-ready tool cannot expose a route alias: ${tool.id} -> ${alias}`);
    aliases.set(alias, tool);
  }
}

const declaredRoutes = new Set();
for (const file of listRouteFiles(routesDir)) {
  for (const route of extractRoutePaths(file)) declaredRoutes.add(route);
}

function isToolRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$');
}

const toolDeclaredRoutes = new Set([...declaredRoutes].filter(isToolRoute));
const expectedToolRoutes = new Set([...canonicalPaths.keys(), ...aliases.keys()].filter((route) => isToolRoute(route)));

const missing = [...expectedToolRoutes].filter((route) => !toolDeclaredRoutes.has(route)).sort();
const orphan = [...toolDeclaredRoutes].filter((route) => !expectedToolRoutes.has(route)).sort();

assert.deepEqual(missing, [], `Routes missing from TOOLS_REGISTRY: ${missing.join(', ')}`);
assert.deepEqual(orphan, [], `Routes missing registry ownership: ${orphan.join(', ')}`);

const photoColorizer = TOOLS_REGISTRY.find((tool) => tool.id === 'photo-colorizer');
assert.ok(photoColorizer, 'photo-colorizer registry entry is missing.');
assert.equal(photoColorizer.isReady, false, 'photo-colorizer must remain non-ready.');
assert.equal(toolDeclaredRoutes.has(photoColorizer.path), false, 'non-ready photo-colorizer route must not be declared.');

console.log('router/registry contract passed');
console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
console.log(`ready tools: ${TOOLS_REGISTRY.filter((tool) => tool.isReady).length}`);
console.log(`non-ready tools: ${TOOLS_REGISTRY.filter((tool) => !tool.isReady).length}`);
console.log(`declared tool routes: ${toolDeclaredRoutes.size}`);
console.log(`expected tool routes: ${expectedToolRoutes.size}`);
console.log(`aliases: ${aliases.size}`);
