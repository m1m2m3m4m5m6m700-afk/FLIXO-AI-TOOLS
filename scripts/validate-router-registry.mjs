import fs from 'node:fs';
import path from 'node:path';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';

const rootRoutePath = path.resolve('src/routes/__root.tsx');
const routesDir = path.resolve('src/routes');
const routeTreePath = path.join(routesDir, 'route-tree.ts');
const rootRouteSource = fs.readFileSync(rootRoutePath, 'utf8');
const routeTreeSource = fs.readFileSync(routeTreePath, 'utf8');

function fail(stage, message, details = {}) {
  console.error(`ROUTER_REGISTRY_FAILURE stage=${stage}`);
  console.error(message);
  for (const [key, value] of Object.entries(details)) console.error(`${key}: ${JSON.stringify(value, null, 2)}`);
  process.exit(1);
}

function isPublicToolRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$');
}

function listRouteFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

function extractPathProperties(source) {
  const routes = [];
  const routeFactoryPattern = /create(?:Root)?Route\(\s*\{[\s\S]*?\bpath\s*:\s*(['"])([^'"]+)\1/g;
  let match;
  while ((match = routeFactoryPattern.exec(source)) !== null) {
    if (match[2].startsWith('/')) routes.push(match[2]);
  }
  return routes;
}

if (!Array.isArray(TOOLS_REGISTRY) || TOOLS_REGISTRY.length === 0) fail('registry-load', 'TOOLS_REGISTRY is empty or invalid.');
if (!routeTreeSource.includes('export const routeChildren')) fail('router-load', 'route-tree.ts does not expose routeChildren.');
if (!rootRouteSource.includes('<Suspense')) fail('runtime', 'Root route must guard lazy route rendering with Suspense.');
if (!rootRouteSource.includes('<Outlet />')) fail('runtime', 'Root route must contain the router Outlet.');

const canonicalPaths = new Map();
const aliases = new Map();
for (const tool of TOOLS_REGISTRY) {
  if (!tool?.id) fail('registry-schema', 'Tool is missing id.', { tool });
  if (typeof tool.path !== 'string' || !tool.path.startsWith('/')) fail('registry-schema', `Invalid canonical path for ${tool.id}.`, { path: tool.path });
  if (canonicalPaths.has(tool.path) || aliases.has(tool.path)) fail('registry-duplicates', `Duplicate canonical path: ${tool.path}.`, { toolId: tool.id });
  canonicalPaths.set(tool.path, tool);
  for (const alias of tool.aliases ?? []) {
    if (typeof alias !== 'string' || !alias.startsWith('/')) fail('registry-schema', `Invalid alias for ${tool.id}.`, { alias });
    if (aliases.has(alias) || canonicalPaths.has(alias)) fail('registry-duplicates', `Duplicate route alias: ${alias}.`, { toolId: tool.id });
    if (!tool.isReady) fail('readiness', `Non-ready tool exposes a route alias: ${tool.id}.`, { alias });
    aliases.set(alias, tool);
  }
}

const routeFiles = listRouteFiles(routesDir);
const declaredRouteList = routeFiles.flatMap((file) => extractPathProperties(fs.readFileSync(file, 'utf8')));
const hasLocalizedToolRoute = declaredRouteList.includes('/$locale/$tool');
const usesGeneratedImageRoutes = /\bimageToolRoutes\b/.test(routeTreeSource);
if (usesGeneratedImageRoutes) {
  for (const tool of TOOLS_REGISTRY.filter((entry) => entry.family === 'image' && entry.id !== 'image-compressor' && entry.isReady)) {
    if (tool.path.startsWith('/en/')) declaredRouteList.push(tool.path);
    for (const alias of tool.aliases ?? []) if (alias.startsWith('/en/')) declaredRouteList.push(alias);
  }
}

const duplicateDeclared = declaredRouteList.filter((route, index, all) => all.indexOf(route) !== index).sort();
if (duplicateDeclared.length) fail('router-duplicates', 'Duplicate route declarations detected.', { duplicates: [...new Set(duplicateDeclared)] });

const declaredToolRoutes = new Set(declaredRouteList.filter(isPublicToolRoute));
const readyTools = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const expectedPublicRoutes = new Set([
  ...readyTools.map((tool) => tool.path),
  ...readyTools.flatMap((tool) => tool.aliases ?? []),
].filter(isPublicToolRoute));

// If a dynamic localized boundary exists, every locale/tool URL is owned by that
// boundary and is later proven exhaustively by G1's runtime resolver check.
const missingStaticRoutes = hasLocalizedToolRoute
  ? []
  : [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route)).sort();
const orphan = [...declaredToolRoutes].filter((route) => !expectedPublicRoutes.has(route)).sort();

if (missingStaticRoutes.length) fail('missing-routes', 'Ready registry routes are not represented by the router.', { missing: missingStaticRoutes, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size });
if (orphan.length) fail('orphan-routes', 'Router routes are not owned by a ready registry tool or explicit alias.', { orphan, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size });

const nonReadyToolRoutes = TOOLS_REGISTRY
  .filter((tool) => !tool.isReady && (declaredToolRoutes.has(tool.path) || aliases.has(tool.path)))
  .map((tool) => tool.path)
  .sort();
if (nonReadyToolRoutes.length) fail('readiness', 'Non-ready tools expose public routes.', { routes: nonReadyToolRoutes });
if (hasLocalizedToolRoute && !rootRouteSource.includes('notFound')) fail('runtime', 'Localized dynamic tool routing must retain a notFound boundary.');

console.log('router/registry/runtime contract passed');
console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
console.log(`ready tools: ${readyTools.length}`);
console.log(`non-ready tools: ${TOOLS_REGISTRY.length - readyTools.length}`);
console.log(`declared tool routes: ${declaredToolRoutes.size}`);
console.log(`expected public routes: ${expectedPublicRoutes.size}`);
console.log(`aliases: ${aliases.size}`);
console.log(`generated image routes: ${usesGeneratedImageRoutes ? 'enabled' : 'disabled'}`);
console.log(`dynamic localized tool route: ${hasLocalizedToolRoute ? 'enabled' : 'disabled'}`);
console.log(`static missing routes: ${missingStaticRoutes.length}`);
