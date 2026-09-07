import fs from 'node:fs';
import path from 'node:path';
import { TOOL_REGISTRY } from '../src/config/registry.ts';

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

if (!Array.isArray(TOOL_REGISTRY) || TOOL_REGISTRY.length === 0) fail('registry-load', 'TOOL_REGISTRY is empty or invalid.');
if (!routeTreeSource.includes('export const routeChildren')) fail('router-load', 'route-tree.ts does not expose routeChildren.');
if (!rootRouteSource.includes('<Suspense')) fail('runtime', 'Root route must guard lazy route rendering with Suspense.');
if (!rootRouteSource.includes('<Outlet />')) fail('runtime', 'Root route must contain the router Outlet.');
if (!routeTreeSource.includes('localizedToolRoute')) fail('router-load', 'Image-only router must register localizedToolRoute.');

const canonicalPaths = new Map();
const aliases = new Map();
for (const tool of TOOL_REGISTRY) {
  if (tool.category !== 'Images') fail('registry-scope', `Non-image tool remains in TOOL_REGISTRY: ${tool.id}`);
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

const routeSources = listRouteFiles(routesDir).map((file) => fs.readFileSync(file, 'utf8'));
const declaredRouteList = routeSources.flatMap(extractPathProperties);
const declaredRoutes = new Set(declaredRouteList);
const expectedPublicRoutes = new Set(
  [...canonicalPaths.entries()]
    .filter(([, tool]) => tool.isReady)
    .map(([route]) => route)
    .concat([...aliases.keys()]),
);
const missingDynamicBoundary = expectedPublicRoutes.size > 0 && !declaredRoutes.has('/$locale/$tool');
if (missingDynamicBoundary) fail('localized-boundary', 'Image routes require the registry-backed /$locale/$tool dynamic boundary.');

const explicitPublicRoutes = [...declaredRoutes].filter((route) => route.split('/').filter(Boolean).length === 2 && /^[a-z]{2}$/u.test(route.split('/').filter(Boolean)[0]) && !route.includes('$'));
const orphan = explicitPublicRoutes.filter((route) => !expectedPublicRoutes.has(route));
if (orphan.length) fail('orphan-routes', 'Router contains public tool routes not owned by TOOL_REGISTRY.', { orphan });

const nonReadyToolRoutes = TOOL_REGISTRY
  .filter((tool) => !tool.isReady)
  .filter((tool) => declaredRoutes.has(tool.path) || [...aliases.keys()].some((alias) => declaredRoutes.has(alias)))
  .map((tool) => tool.path);
if (nonReadyToolRoutes.length) fail('readiness', 'Non-ready image tools expose public routes.', { routes: nonReadyToolRoutes });

console.log('image-only router/registry/runtime contract passed');
console.log(`registry tools: ${TOOL_REGISTRY.length}`);
console.log(`ready tools: ${TOOL_REGISTRY.filter((tool) => tool.isReady).length}`);
console.log(`non-ready tools: ${TOOL_REGISTRY.filter((tool) => !tool.isReady).length}`);
console.log(`dynamic localized tool route: enabled`);
