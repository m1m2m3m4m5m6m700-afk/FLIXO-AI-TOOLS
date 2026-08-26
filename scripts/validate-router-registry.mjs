import fs from 'node:fs';
import path from 'node:path';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';

const routeTreePath = path.resolve('src/routes/route-tree.ts');
const routeTreeSource = fs.readFileSync(routeTreePath, 'utf8');

function fail(stage, message, details = {}) {
  console.error(`ROUTER_REGISTRY_FAILURE stage=${stage}`);
  console.error(message);
  for (const [key, value] of Object.entries(details)) {
    console.error(`${key}: ${JSON.stringify(value, null, 2)}`);
  }
  process.exit(1);
}

function isPublicToolRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$');
}

function extractExplicitRoutes(source) {
  const routes = [];
  const routeReferencePattern = /\b(?:export const|const)\s+\w+\s*=\s*(?:[^\n]*createRoute\([^\n]*path:\s*['\"]([^'\"]+)['\"]|[^\n]*\{\s*path:\s*['\"]([^'\"]+)['\"])/g;
  let match;
  while ((match = routeReferencePattern.exec(source)) !== null) {
    const route = match[1] ?? match[2];
    if (route) routes.push(route);
  }
  return routes;
}

if (!Array.isArray(TOOLS_REGISTRY) || TOOLS_REGISTRY.length === 0) {
  fail('registry-load', 'TOOLS_REGISTRY is empty or invalid.');
}

if (!routeTreeSource.includes('export const routeChildren')) {
  fail('router-load', 'route-tree.ts does not expose routeChildren.');
}

const canonicalPaths = new Map();
const aliases = new Map();

for (const tool of TOOLS_REGISTRY) {
  if (!tool?.id) fail('registry-schema', 'Tool is missing id.', { tool });
  if (typeof tool.path !== 'string' || !tool.path.startsWith('/')) {
    fail('registry-schema', `Invalid canonical path for ${tool.id}.`, { path: tool.path });
  }
  if (canonicalPaths.has(tool.path) || aliases.has(tool.path)) {
    fail('registry-duplicates', `Duplicate canonical path: ${tool.path}.`, { toolId: tool.id });
  }
  canonicalPaths.set(tool.path, tool);

  for (const alias of tool.aliases ?? []) {
    if (typeof alias !== 'string' || !alias.startsWith('/')) {
      fail('registry-schema', `Invalid alias for ${tool.id}.`, { alias });
    }
    if (aliases.has(alias) || canonicalPaths.has(alias)) {
      fail('registry-duplicates', `Duplicate route alias: ${alias}.`, { toolId: tool.id });
    }
    if (!tool.isReady) {
      fail('readiness', `Non-ready tool exposes a route alias: ${tool.id}.`, { alias });
    }
    aliases.set(alias, tool);
  }
}

const explicitRoutes = extractExplicitRoutes(routeTreeSource);
const declaredRoutes = new Set(explicitRoutes);

// Image routes are intentionally generated from IMAGE_TOOLS and inserted into routeChildren
// as a route array. The contract validates that generated boundary without executing the
// TypeScript route module (which would require a TS-aware runtime and its internal imports).
const usesGeneratedImageRoutes = /\bimageToolRoutes\b/.test(routeTreeSource);
if (usesGeneratedImageRoutes) {
  for (const tool of TOOLS_REGISTRY) {
    if (tool.isReady && tool.path.startsWith('/en/')) declaredRoutes.add(tool.path);
    for (const alias of tool.aliases ?? []) {
      if (alias.startsWith('/en/')) declaredRoutes.add(alias);
    }
  }
}

const declaredToolRoutes = new Set([...declaredRoutes].filter(isPublicToolRoute));

const expectedPublicRoutes = new Set(
  [...canonicalPaths.entries()]
    .filter(([, tool]) => tool.isReady)
    .map(([route]) => route)
    .concat([...aliases.keys()])
    .filter(isPublicToolRoute),
);

const duplicateDeclared = [...explicitRoutes]
  .filter((route, index, all) => all.indexOf(route) !== index)
  .sort();

if (duplicateDeclared.length) {
  fail('router-duplicates', 'Duplicate route declarations detected.', {
    duplicates: duplicateDeclared,
  });
}

if (usesGeneratedImageRoutes && !routeTreeSource.includes('imageToolRoutes')) {
  fail('router-generated-routes', 'Generated image routes were expected but not referenced by route-tree.ts.');
}

const missing = [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route)).sort();
const orphan = [...declaredToolRoutes].filter((route) => !expectedPublicRoutes.has(route)).sort();

if (missing.length) {
  fail('missing-routes', 'Ready registry routes are not represented by the router.', {
    missing,
    expectedCount: expectedPublicRoutes.size,
    declaredCount: declaredToolRoutes.size,
  });
}

if (orphan.length) {
  fail('orphan-routes', 'Router routes are not owned by a ready registry tool or explicit alias.', {
    orphan,
    expectedCount: expectedPublicRoutes.size,
    declaredCount: declaredToolRoutes.size,
  });
}

const nonReadyToolRoutes = TOOLS_REGISTRY
  .filter((tool) => !tool.isReady && (declaredToolRoutes.has(tool.path) || aliases.has(tool.path)))
  .map((tool) => tool.path)
  .sort();

if (nonReadyToolRoutes.length) {
  fail('readiness', 'Non-ready tools expose public routes.', { routes: nonReadyToolRoutes });
}

console.log('router/registry contract passed');
console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
console.log(`ready tools: ${TOOLS_REGISTRY.filter((tool) => tool.isReady).length}`);
console.log(`non-ready tools: ${TOOLS_REGISTRY.filter((tool) => !tool.isReady).length}`);
console.log(`declared tool routes: ${declaredToolRoutes.size}`);
console.log(`expected public routes: ${expectedPublicRoutes.size}`);
console.log(`aliases: ${aliases.size}`);
console.log(`generated image routes: ${usesGeneratedImageRoutes ? 'enabled' : 'disabled'}`);
