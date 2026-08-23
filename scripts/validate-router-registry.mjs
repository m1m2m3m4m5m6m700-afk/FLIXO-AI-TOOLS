import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const routesDir = path.join(root, 'src/routes');

const { TOOLS_REGISTRY } = await import('../src/config/tools.ts');

function fail(stage, message, details = {}) {
  console.error(`ROUTER_REGISTRY_FAILURE stage=${stage}`);
  console.error(message);
  for (const [key, value] of Object.entries(details)) {
    console.error(`${key}: ${JSON.stringify(value, null, 2)}`);
  }
  process.exitCode = 1;
}

function propertyName(node) {
  if (!node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function literalString(node) {
  return ts.isStringLiteral(node) ? node.text : null;
}

function extractRoutePaths(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = [];

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      if (callee === 'createRoute' || callee === 'imageToolRoute') {
        const [argument] = node.arguments;
        if (callee === 'createRoute' && argument && ts.isObjectLiteralExpression(argument)) {
          const pathProperty = argument.properties.find(
            (property) => ts.isPropertyAssignment(property) && propertyName(property) === 'path',
          );
          const route = pathProperty && ts.isPropertyAssignment(pathProperty)
            ? literalString(pathProperty.initializer)
            : null;
          if (route) routes.push({ route, file: filePath, kind: callee });
        } else if (callee === 'imageToolRoute') {
          const route = literalString(node.arguments[0]);
          if (route) routes.push({ route, file: filePath, kind: callee });
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

try {
  if (!Array.isArray(TOOLS_REGISTRY) || TOOLS_REGISTRY.length === 0) {
    fail('registry-load', 'TOOLS_REGISTRY is empty or invalid.');
    process.exit(1);
  }

  const canonicalPaths = new Map();
  const aliases = new Map();

  for (const tool of TOOLS_REGISTRY) {
    if (!tool.id) {
      fail('registry-schema', 'Tool is missing id.', { tool });
      process.exit(1);
    }
    if (typeof tool.path !== 'string' || !tool.path.startsWith('/')) {
      fail('registry-schema', `Invalid canonical path for ${tool.id}.`, { path: tool.path });
      process.exit(1);
    }
    if (canonicalPaths.has(tool.path) || aliases.has(tool.path)) {
      fail('registry-duplicates', `Duplicate canonical path: ${tool.path}.`, { toolId: tool.id });
      process.exit(1);
    }
    canonicalPaths.set(tool.path, tool);

    for (const alias of tool.aliases ?? []) {
      if (typeof alias !== 'string' || !alias.startsWith('/')) {
        fail('registry-schema', `Invalid alias for ${tool.id}.`, { alias });
        process.exit(1);
      }
      if (aliases.has(alias) || canonicalPaths.has(alias)) {
        fail('registry-duplicates', `Duplicate route alias: ${alias}.`, { toolId: tool.id });
        process.exit(1);
      }
      if (!tool.isReady) {
        fail('readiness', `Non-ready tool exposes a route alias: ${tool.id}.`, { alias });
        process.exit(1);
      }
      aliases.set(alias, tool);
    }
  }

  const routeRecords = listRouteFiles(routesDir).flatMap(extractRoutePaths);
  const declaredRoutes = new Set(routeRecords.map(({ route }) => route));

  const toolDeclaredRoutes = new Set(
    [...declaredRoutes].filter((route) => {
      const parts = route.split('/').filter(Boolean);
      return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$');
    }),
  );
  const expectedToolRoutes = new Set(
    [...canonicalPaths.keys(), ...aliases.keys()].filter((route) => {
      const parts = route.split('/').filter(Boolean);
      return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$');
    }),
  );

  const duplicateDeclared = routeRecords
    .map(({ route }) => route)
    .filter((route, index, all) => all.indexOf(route) !== index)
    .filter((route, index, all) => all.indexOf(route) === index)
    .sort();

  const missing = [...expectedToolRoutes].filter((route) => !toolDeclaredRoutes.has(route)).sort();
  const orphan = [...toolDeclaredRoutes].filter((route) => !expectedToolRoutes.has(route)).sort();

  if (duplicateDeclared.length) {
    fail('router-duplicates', 'Duplicate route declarations detected.', { duplicates: duplicateDeclared });
    process.exit(1);
  }

  if (missing.length) {
    fail('missing-routes', 'Registry routes are not represented by the router.', {
      missing,
      expectedCount: expectedToolRoutes.size,
      declaredCount: toolDeclaredRoutes.size,
    });
    process.exit(1);
  }

  if (orphan.length) {
    fail('orphan-routes', 'Router routes are not owned by TOOLS_REGISTRY.', {
      orphan,
      expectedCount: expectedToolRoutes.size,
      declaredCount: toolDeclaredRoutes.size,
    });
    process.exit(1);
  }

  const photoColorizer = TOOLS_REGISTRY.find((tool) => tool.id === 'photo-colorizer');
  if (!photoColorizer) {
    fail('readiness', 'photo-colorizer registry entry is missing.');
    process.exit(1);
  }
  assert.equal(photoColorizer.isReady, false, 'photo-colorizer must remain non-ready.');
  if (toolDeclaredRoutes.has(photoColorizer.path)) {
    fail('readiness', 'Non-ready photo-colorizer route is declared.', { path: photoColorizer.path });
    process.exit(1);
  }

  console.log('router/registry contract passed');
  console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
  console.log(`ready tools: ${TOOLS_REGISTRY.filter((tool) => tool.isReady).length}`);
  console.log(`non-ready tools: ${TOOLS_REGISTRY.filter((tool) => !tool.isReady).length}`);
  console.log(`declared tool routes: ${toolDeclaredRoutes.size}`);
  console.log(`expected tool routes: ${expectedToolRoutes.size}`);
  console.log(`aliases: ${aliases.size}`);
} catch (error) {
  fail('unexpected', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
}
