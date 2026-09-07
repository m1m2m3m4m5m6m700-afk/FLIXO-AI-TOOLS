import fs from 'node:fs';
import path from 'node:path';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config.ts';
import { getToolSeo } from '../src/lib/seo/tool-seo.ts';

const rootRoutePath = path.resolve('src/routes/__root.tsx');
const localizedToolRoutePath = path.resolve('src/routes/localized-tool.tsx');
const routesDir = path.resolve('src/routes');
const routeTreePath = path.join(routesDir, 'route-tree.ts');
const runtimeLocalePath = path.resolve('src/lib/i18n/runtime-document-locale.ts');
const autoSurfacePath = path.resolve('src/components/auto-localized-tool-surface.tsx');
const rootRouteSource = fs.readFileSync(rootRoutePath, 'utf8');
const localizedToolRouteSource = fs.readFileSync(localizedToolRoutePath, 'utf8');
const routeTreeSource = fs.readFileSync(routeTreePath, 'utf8');
const runtimeLocaleSource = fs.readFileSync(runtimeLocalePath, 'utf8');
const autoSurfaceSource = fs.readFileSync(autoSurfacePath, 'utf8');

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

function resolveLocalModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function listReachableRouteModules(entryFiles) {
  const reachable = new Set();
  const pending = [...entryFiles];
  const importPattern = /(?:import\s+(?:[\s\S]*?\sfrom\s+)?|export\s+(?:[\s\S]*?\sfrom\s+)|import\s*\()(['"])([^'"]+)\1/g;

  while (pending.length) {
    const file = pending.pop();
    if (!file || reachable.has(file) || !fs.existsSync(file)) continue;
    reachable.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveLocalModule(file, match[2]);
      if (resolved && resolved.startsWith(`${routesDir}${path.sep}`) && !reachable.has(resolved)) pending.push(resolved);
    }
  }
  return reachable;
}

function extractPathProperties(source) {
  const routes = [];
  const routeFactoryPattern = /create(?:Root)?Route\(\s*\{[\s\S]*?\bpath\s*:\s*(['"])([^'"]+)\1/g;
  let match;
  while ((match = routeFactoryPattern.exec(source)) !== null) {
    const route = match[2];
    if (route.startsWith('/')) routes.push(route);
  }
  return routes;
}

if (!Array.isArray(TOOLS_REGISTRY) || TOOLS_REGISTRY.length === 0) fail('registry-load', 'TOOLS_REGISTRY is empty or invalid.');
if (!routeTreeSource.includes('export const routeChildren')) fail('router-load', 'route-tree.ts does not expose routeChildren.');
if (!rootRouteSource.includes('<Suspense')) fail('runtime', 'Root route must guard lazy route rendering with Suspense.');
if (!rootRouteSource.includes('<Outlet />')) fail('runtime', 'Root route must contain the router Outlet.');
if (!rootRouteSource.includes('errorComponent: ErrorComponent')) fail('error-boundary', 'Root route must install the global ErrorComponent.');
if (!rootRouteSource.includes('notFoundComponent: NotFoundComponent')) fail('not-found', 'Root route must install the global NotFoundComponent.');
if (!localizedToolRouteSource.includes('errorComponent: ErrorComponent')) fail('error-boundary', 'Dynamic localized tool route must install ErrorComponent.');
if (!localizedToolRouteSource.includes('notFoundComponent: NotFoundComponent')) fail('not-found', 'Dynamic localized tool route must install NotFoundComponent.');

const htmlMutationPattern = /(?:document\.documentElement|\.setAttribute\(\s*['"](?:lang|dir|data-flixo-locale)['"]|\.(?:lang|dir)\s*=)/u;
if (!runtimeLocaleSource.includes('document.documentElement') || !runtimeLocaleSource.includes("setAttribute('lang'") || !runtimeLocaleSource.includes("setAttribute('dir'")) {
  fail('dom-owner', 'The canonical document locale owner must mutate html lang/dir attributes.');
}
if (htmlMutationPattern.test(rootRouteSource)) fail('dom-owner', 'Root entry layout must not mutate document locale attributes; runtime-document-locale.ts is the sole owner.');
const competingDomOwners = listRouteFiles(routesDir)
  .filter((file) => file !== rootRoutePath)
  .filter((file) => htmlMutationPattern.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'))
  .filter((file) => file !== 'src/routes/__root.tsx')
  .sort();
if (competingDomOwners.length) fail('dom-owner', 'Route modules contain competing document locale writers.', { competingDomOwners });

const localizedToolLines = autoSurfaceSource.split(/\r?\n/u);
const allowedPortugueseItalianMatches = new Set(['Prompt']);
for (const line of localizedToolLines) {
  const match = line.match(/pt:\s*'([^']*)'.*?it:\s*'([^']*)'/u);
  if (!match) continue;
  const [, portuguese, italian] = match;
  if (portuguese === italian && !allowedPortugueseItalianMatches.has(portuguese)) {
    fail('i18n-purity', 'Portuguese dictionary contains an Italian-equal value.', { value: portuguese });
  }
  if (/\b(?:Scegli|Elaborazione|Compressione|Scarica|Salva|Reimposta|Tolleranza)\b/u.test(portuguese)) {
    fail('i18n-purity', 'Portuguese auto-localization dictionary contains Italian lexical markers.', { value: portuguese });
  }
}

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
const routeSources = routeFiles.map((file) => fs.readFileSync(file, 'utf8'));
const declaredRouteList = routeSources.flatMap(extractPathProperties);
const hasLocalizedToolRoute = declaredRouteList.includes('/$locale/$tool');

const usesGeneratedImageRoutes = /\bimageToolRoutes\b/.test(routeTreeSource);
if (usesGeneratedImageRoutes) {
  for (const tool of TOOLS_REGISTRY.filter((entry) => entry.family === 'image' && entry.id !== 'image-compressor')) {
    if (tool.isReady && tool.path.startsWith('/en/')) declaredRouteList.push(tool.path);
    for (const alias of tool.aliases ?? []) if (alias.startsWith('/en/')) declaredRouteList.push(alias);
  }
}

const duplicateDeclared = declaredRouteList.filter((route, index, all) => all.indexOf(route) !== index).sort();
if (duplicateDeclared.length) fail('router-duplicates', 'Duplicate route declarations detected.', { duplicates: [...new Set(duplicateDeclared)] });

const declaredRoutes = new Set(declaredRouteList);
const declaredToolRoutes = new Set([...declaredRoutes].filter(isPublicToolRoute));
const expectedPublicRoutes = new Set(
  [...canonicalPaths.entries()]
    .filter(([, tool]) => tool.isReady)
    .map(([route]) => route)
    .concat([...aliases.keys()])
    .filter(isPublicToolRoute),
);

const dynamicOwnedExpectedRoutes = hasLocalizedToolRoute
  ? [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route))
  : [];
const missing = [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route) && !dynamicOwnedExpectedRoutes.includes(route)).sort();
const orphan = [...declaredToolRoutes].filter((route) => !expectedPublicRoutes.has(route)).sort();
if (missing.length) fail('missing-routes', 'Ready registry routes are not represented by the router.', { missing, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size, dynamicLocalizedRoute: hasLocalizedToolRoute });
if (orphan.length) fail('orphan-routes', 'Router routes are not owned by a ready registry tool or explicit alias.', { orphan, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size, dynamicLocalizedRoute: hasLocalizedToolRoute });

const nonReadyToolRoutes = TOOLS_REGISTRY
  .filter((tool) => !tool.isReady && (declaredToolRoutes.has(tool.path) || aliases.has(tool.path)))
  .map((tool) => tool.path)
  .sort();
if (nonReadyToolRoutes.length) fail('readiness', 'Non-ready tools expose public routes.', { routes: nonReadyToolRoutes });

for (const tool of TOOLS_REGISTRY.filter((entry) => entry.isReady)) {
  for (const locale of LOCALES) {
    const seo = getToolSeo(locale, tool.id);
    if (!seo) fail('localized-seo', `Missing localized SEO metadata for ${tool.id}/${locale}.`);
    if (typeof seo.title !== 'string' || !seo.title.trim()) fail('localized-seo', `Missing localized SEO title for ${tool.id}/${locale}.`);
    if (typeof seo.description !== 'string' || !seo.description.trim()) fail('localized-seo', `Missing localized SEO description for ${tool.id}/${locale}.`);
    if (seo.languageTag !== LOCALE_METADATA[locale]?.languageTag) fail('localized-seo', `Language tag drift for ${tool.id}/${locale}.`, { expected: LOCALE_METADATA[locale]?.languageTag, actual: seo.languageTag });
    if (seo.direction !== LOCALE_METADATA[locale]?.direction) fail('localized-seo', `Direction drift for ${tool.id}/${locale}.`, { expected: LOCALE_METADATA[locale]?.direction, actual: seo.direction });
    if (locale !== 'en' && seo.title.trim() === tool.title.trim() && seo.description.trim() === tool.description.trim()) {
      fail('localized-seo', `Localized SEO collapsed to the English registry baseline for ${tool.id}/${locale}.`);
    }
  }
}

const routeEntryModules = new Set([routeTreePath, rootRoutePath]);
const reachableRouteModules = listReachableRouteModules([...routeEntryModules]);
const orphanRouteFiles = routeFiles
  .filter((file) => !reachableRouteModules.has(file))
  .map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'))
  .sort();
if (orphanRouteFiles.length) {
  fail('orphan-route-files', 'Unreferenced route files exist under src/routes/. Verify route-tree and dynamic fallback mappings before deleting anything.', { orphanRouteFiles, routeFileCount: routeFiles.length });
}

console.log('router/registry/runtime contract passed');
console.log(`registry tools: ${TOOLS_REGISTRY.length}`);
console.log(`ready tools: ${TOOLS_REGISTRY.filter((tool) => tool.isReady).length}`);
console.log(`non-ready tools: ${TOOLS_REGISTRY.filter((tool) => !tool.isReady).length}`);
console.log(`declared tool routes: ${declaredToolRoutes.size}`);
console.log(`expected public routes: ${expectedPublicRoutes.size}`);
console.log(`aliases: ${aliases.size}`);
console.log(`generated image routes: ${usesGeneratedImageRoutes ? 'enabled' : 'disabled'}`);
console.log(`dynamic localized tool route: ${hasLocalizedToolRoute ? 'enabled' : 'disabled'}`);
console.log(`dynamic-owned ready routes: ${dynamicOwnedExpectedRoutes.length}`);
console.log(`reachable route modules: ${reachableRouteModules.size}/${routeFiles.length}`);
console.log('orphan route files: 0');
console.log('localized SEO matrix: validated');
console.log('DOM locale owner: runtime-document-locale.ts');
console.log('auto-localized dictionary purity: validated');
console.log('lazy route Suspense: enabled');
