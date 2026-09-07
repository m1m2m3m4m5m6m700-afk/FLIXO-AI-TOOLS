import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config.ts';
import { getToolSeo } from '../src/lib/seo/tool-seo.ts';

const rootRoutePath = path.resolve('src/routes/__root.tsx');
const localizedToolRoutePath = path.resolve('src/routes/localized-tool.tsx');
const routesDir = path.resolve('src/routes');
const routeTreePath = path.join(routesDir, 'route-tree.ts');
const mainPath = path.resolve('src/main.tsx');
const indexPath = path.resolve('index.html');
const documentLocalePath = path.resolve('src/lib/i18n/runtime-document-locale.ts');
const rootRouteSource = fs.readFileSync(rootRoutePath, 'utf8');
const localizedToolRouteSource = fs.readFileSync(localizedToolRoutePath, 'utf8');
const routeTreeSource = fs.readFileSync(routeTreePath, 'utf8');
const mainSource = fs.readFileSync(mainPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const documentLocaleSource = fs.readFileSync(documentLocalePath, 'utf8');

function fail(stage, message, details = {}) { console.error(`ROUTER_REGISTRY_FAILURE stage=${stage}`); console.error(message); for (const [key, value] of Object.entries(details)) console.error(`${key}: ${JSON.stringify(value, null, 2)}`); process.exit(1); }
function isPublicToolRoute(route) { const parts = route.split('/').filter(Boolean); return parts.length === 2 && parts[0].length === 2 && !parts[1].startsWith('$'); }
function listRouteFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const fullPath = path.join(dir, entry.name); if (entry.isDirectory()) return listRouteFiles(fullPath); return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : []; }); }
function listSourceFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const fullPath = path.join(dir, entry.name); if (entry.isDirectory()) return listSourceFiles(fullPath); return entry.isFile() && /\.(?:ts|tsx|mts|cts)$/u.test(entry.name) ? [fullPath] : []; }); }
function resolveLocalModule(fromFile, specifier) { if (!specifier.startsWith('.')) return null; const base = path.resolve(path.dirname(fromFile), specifier); const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]; return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null; }
function listReachableRouteModules(entryFiles) { const reachable = new Set(); const pending = [...entryFiles]; const importPattern = /(?:import\s+(?:[\s\S]*?\sfrom\s+)?|export\s+(?:[\s\S]*?\sfrom\s+)|import\s*\()(['"])([^'"]+)\1/g; while (pending.length) { const file = pending.pop(); if (!file || reachable.has(file) || !fs.existsSync(file)) continue; reachable.add(file); const source = fs.readFileSync(file, 'utf8'); for (const match of source.matchAll(importPattern)) { const resolved = resolveLocalModule(file, match[2]); if (resolved && resolved.startsWith(`${routesDir}${path.sep}`) && !reachable.has(resolved)) pending.push(resolved); } } return reachable; }
function extractPathProperties(source) { const routes = []; const routeFactoryPattern = /create(?:Root)?Route\(\s*\{[\s\S]*?\bpath\s*:\s*(['"])([^'"]+)\1/g; let match; while ((match = routeFactoryPattern.exec(source)) !== null) { if (match[2].startsWith('/')) routes.push(match[2]); } return routes; }
function unwrapExpression(node) { let current = node; while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current))) current = current.expression; return current; }
function propertyName(property) { if (!property.name) return null; if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text; return null; }
function findProperty(objectLiteral, name) { return objectLiteral.properties.find((property) => propertyName(property) === name) ?? null; }
function isRouteHeadProperty(property) { return propertyName(property) === 'head' && !!property.initializer; }
function getHeadResultObject(property) { let initializer = unwrapExpression(property.initializer); if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) initializer = unwrapExpression(initializer.body); return initializer && ts.isObjectLiteralExpression(initializer) ? initializer : null; }
function hasRouteSeoMetadata(source) { const sourceFile = ts.createSourceFile('route.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let valid = false; function inspect(node) { if (valid) return; if (ts.isObjectLiteralExpression(node)) { const head = node.properties.find(isRouteHeadProperty); if (head) { const headObject = getHeadResultObject(head); const meta = headObject && findProperty(headObject, 'meta'); const metaArray = meta ? unwrapExpression(meta.initializer) : null; if (metaArray && ts.isArrayLiteralExpression(metaArray)) { let title = false; let description = false; for (const element of metaArray.elements) { const item = unwrapExpression(element); if (!item || !ts.isObjectLiteralExpression(item)) continue; title ||= !!findProperty(item, 'title'); description ||= !!findProperty(item, 'description'); } valid = title && description; } } } if (!valid) ts.forEachChild(node, inspect); } inspect(sourceFile); return valid; }

if (!Array.isArray(TOOLS_REGISTRY) || TOOLS_REGISTRY.length === 0) fail('registry-load', 'TOOLS_REGISTRY is empty or invalid.');
if (!routeTreeSource.includes('export const routeChildren')) fail('router-load', 'route-tree.ts does not expose routeChildren.');
if (!rootRouteSource.includes('<Suspense')) fail('runtime', 'Root route must guard lazy route rendering with Suspense.');
if (!rootRouteSource.includes('<Outlet />')) fail('runtime', 'Root route must contain the router Outlet.');
if (!rootRouteSource.includes('<RouteErrorBoundary>')) fail('error-boundary', 'Root route must wrap the application Outlet in RouteErrorBoundary.');
if (!rootRouteSource.includes('errorComponent: ErrorComponent')) fail('error-boundary', 'Root route must install the global ErrorComponent.');
if (!rootRouteSource.includes('notFoundComponent: NotFoundComponent')) fail('not-found', 'Root route must install the global NotFoundComponent.');
if (!localizedToolRouteSource.includes('errorComponent: ErrorComponent')) fail('error-boundary', 'Dynamic localized tool route must install ErrorComponent.');
if (!localizedToolRouteSource.includes('notFoundComponent: NotFoundComponent')) fail('not-found', 'Dynamic localized tool route must install NotFoundComponent.');
if (!mainSource.includes("applyDocumentLocale(localeFromPathname(window.location.pathname))")) fail('dom-owner', 'Application bootstrap must synchronously apply the canonical document locale.');
if (!rootRouteSource.includes('applyDocumentLocale(localeFromPathname(location.pathname))')) fail('dom-owner', 'Route navigation must update document locale from canonical pathname state.');
if (!documentLocaleSource.includes('export function localeFromPathname(')) fail('dom-owner', 'Canonical locale parser is missing.');
if (!documentLocaleSource.includes('export function applyDocumentLocale(')) fail('dom-owner', 'Canonical document locale writer is missing.');
if (/\bnew\s+MutationObserver\s*\(|\bsetInterval\s*\(|\brequestAnimationFrame\s*\(/u.test(documentLocaleSource)) fail('dom-ownership', 'Canonical document locale writer must not use observers, polling, or frame repair.');
if (indexSource.includes('new MutationObserver')) fail('dom-observer', 'index.html must not repair locale with MutationObserver.');
if (!indexSource.includes('localeMap') || !indexSource.includes('data-flixo-locale')) fail('dom-owner', 'index.html must retain synchronous locale bootstrap metadata.');

const forbiddenRuntimeFiles = ['src/lib/i18n/tool-ui-runtime-supplement.ts','src/components/auto-localized-tool-surface.tsx'];
const remainingLegacyRuntimeFiles = forbiddenRuntimeFiles.filter((relativePath) => fs.existsSync(path.resolve(relativePath)));
if (remainingLegacyRuntimeFiles.length) fail('dom-ownership', 'Obsolete localization runtime files are still present.', { files: remainingLegacyRuntimeFiles });

const sourceFiles = listSourceFiles(path.resolve('src'));
const sourceRecords = sourceFiles.map((file) => ({ file, relative: path.relative(process.cwd(), file).split(path.sep).join('/'), source: fs.readFileSync(file, 'utf8') }));
const localeMutationPattern = /document\.documentElement(?:\.setAttribute\(\s*['"](?:lang|dir|data-flixo-locale)['"]|\.(?:lang|dir)\s*=)/u;
const localeMutationOwners = sourceRecords.filter(({ relative, source }) => relative !== 'src/lib/i18n/runtime-document-locale.ts' && localeMutationPattern.test(source)).map(({ relative }) => relative).sort();
if (localeMutationOwners.length) fail('dom-owner', 'Imperative document locale writers remain in production source.', { files: localeMutationOwners });
const forbiddenLocaleObserverOwners = sourceRecords.filter(({ relative, source }) => relative.includes('/i18n/') && /\bnew\s+MutationObserver\s*\(/u.test(source)).map(({ relative }) => relative).sort();
if (forbiddenLocaleObserverOwners.length) fail('dom-observer', 'Localization modules still perform DOM mutation-observer translation.', { files: forbiddenLocaleObserverOwners });
const rawHtmlOwners = sourceRecords.filter(({ source }) => source.includes('dangerouslySetInnerHTML')).filter(({ source }) => !(source.includes('application/ld+json') && /JSON\.stringify\([^)]*\)\.replace\(\/</u.test(source) || source.includes('serializeJsonLd'))).map(({ relative }) => relative).sort();
if (rawHtmlOwners.length) fail('dom-security', 'dangerouslySetInnerHTML is forbidden outside escaped JSON-LD rendering.', { files: rawHtmlOwners });

const requiredOwnedResourceTools = ['src/tools/image-compressor/','src/tools/audio-noise-reducer/','src/tools/ai-vocal-instrumental-remover/','src/tools/image-to-pdf/','src/tools/video-gif-meme/','src/tools/_shared/'];
for (const prefix of requiredOwnedResourceTools) {
  const offenders = sourceRecords.filter(({ relative, source }) => relative.startsWith(prefix) && !relative.endsWith('disposable-resource-owner.ts') && /\b(?:URL\.createObjectURL|new\s+Worker\s*\(|new\s+AudioContext\s*\()/.test(source) && !source.includes('useDisposableResourceOwner') && !source.includes('DisposableResourceOwner')).map(({ relative }) => relative);
  if (offenders.length) fail('resource-owner', 'Media resource creation bypasses the central DisposableResourceOwner.', { files: offenders });
}
const activeFlagOwners = sourceRecords.filter(({ source }) => /\blet\s+(?:active|mounted|cancelled|canceled)\s*=\s*(?:true|false)\b/u.test(source)).map(({ relative }) => relative).sort();
if (activeFlagOwners.length) fail('async-cancellation', 'Ad-hoc async lifecycle booleans are forbidden; use AbortController/AbortSignal.', { files: activeFlagOwners });
const purityOwners = sourceRecords.filter(({ relative, source }) => /^src\/data\/.*(?:i18n|locale|dictionary).*\.ts$/u.test(relative) && /from ['"][^'"]*\/tools\//u.test(source)).map(({ relative }) => relative).sort();
if (purityOwners.length) fail('dictionary-purity', 'Dictionary/data modules must not import tool implementation modules.', { files: purityOwners });

const canonicalPaths = new Map(); const aliases = new Map();
for (const tool of TOOLS_REGISTRY) {
  if (!tool?.id) fail('registry-schema', 'Tool is missing id.', { tool });
  if (typeof tool.path !== 'string' || !tool.path.startsWith('/')) fail('registry-schema', `Invalid canonical path for ${tool.id}.`, { path: tool.path });
  if (canonicalPaths.has(tool.path) || aliases.has(tool.path)) fail('registry-duplicates', `Duplicate canonical path: ${tool.path}.`, { toolId: tool.id });
  canonicalPaths.set(tool.path, tool);
  for (const alias of tool.aliases ?? []) { if (typeof alias !== 'string' || !alias.startsWith('/')) fail('registry-schema', `Invalid alias for ${tool.id}.`, { alias }); if (aliases.has(alias) || canonicalPaths.has(alias)) fail('registry-duplicates', `Duplicate route alias: ${alias}.`, { toolId: tool.id }); if (!tool.isReady) fail('readiness', `Non-ready tool exposes a route alias: ${tool.id}.`, { alias }); aliases.set(alias, tool); }
}
const routeFiles = listRouteFiles(routesDir); const routeSources = routeFiles.map((file) => fs.readFileSync(file, 'utf8')); const declaredRouteList = routeSources.flatMap(extractPathProperties); const hasLocalizedToolRoute = declaredRouteList.includes('/$locale/$tool');
const usesGeneratedImageRoutes = /\bimageToolRoutes\b/.test(routeTreeSource);
if (usesGeneratedImageRoutes) for (const tool of TOOLS_REGISTRY.filter((entry) => entry.family === 'image' && entry.id !== 'image-compressor')) { if (tool.isReady && tool.path.startsWith('/en/')) declaredRouteList.push(tool.path); for (const alias of tool.aliases ?? []) if (alias.startsWith('/en/')) declaredRouteList.push(alias); }
const duplicateDeclared = declaredRouteList.filter((route, index, all) => all.indexOf(route) !== index).sort();
if (duplicateDeclared.length) fail('router-duplicates', 'Duplicate route declarations detected.', { duplicates: [...new Set(duplicateDeclared)] });
const declaredRoutes = new Set(declaredRouteList); const declaredToolRoutes = new Set([...declaredRoutes].filter(isPublicToolRoute));
const expectedPublicRoutes = new Set([...canonicalPaths.entries()].filter(([, tool]) => tool.isReady).map(([route]) => route).concat([...aliases.keys()]).filter(isPublicToolRoute));
const dynamicOwnedExpectedRoutes = hasLocalizedToolRoute ? [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route)) : [];
const missing = [...expectedPublicRoutes].filter((route) => !declaredToolRoutes.has(route) && !dynamicOwnedExpectedRoutes.includes(route)).sort();
const orphan = [...declaredToolRoutes].filter((route) => !expectedPublicRoutes.has(route)).sort();
if (missing.length) fail('missing-routes', 'Ready registry routes are not represented by the router.', { missing, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size, dynamicLocalizedRoute: hasLocalizedToolRoute });
if (orphan.length) fail('orphan-routes', 'Router routes are not owned by a ready registry tool or explicit alias.', { orphan, expectedCount: expectedPublicRoutes.size, declaredCount: declaredToolRoutes.size, dynamicLocalizedRoute: hasLocalizedToolRoute });
const nonReadyToolRoutes = TOOLS_REGISTRY.filter((tool) => !tool.isReady && (declaredToolRoutes.has(tool.path) || aliases.has(tool.path))).map((tool) => tool.path).sort();
if (nonReadyToolRoutes.length) fail('readiness', 'Non-ready tools expose public routes.', { routes: nonReadyToolRoutes });

for (const tool of TOOLS_REGISTRY.filter((entry) => entry.isReady)) for (const locale of LOCALES) {
  const seo = getToolSeo(locale, tool.id);
  if (!seo) fail('localized-seo', `Missing localized SEO metadata for ${tool.id}/${locale}.`);
  if (typeof seo.title !== 'string' || !seo.title.trim()) fail('localized-seo', `Missing localized SEO title for ${tool.id}/${locale}.`);
  if (typeof seo.description !== 'string' || !seo.description.trim()) fail('localized-seo', `Missing localized SEO description for ${tool.id}/${locale}.`);
  if (seo.languageTag !== LOCALE_METADATA[locale]?.languageTag) fail('localized-seo', `Language tag drift for ${tool.id}/${locale}.`, { expected: LOCALE_METADATA[locale]?.languageTag, actual: seo.languageTag });
  if (seo.direction !== LOCALE_METADATA[locale]?.direction) fail('localized-seo', `Direction drift for ${tool.id}/${locale}.`, { expected: LOCALE_METADATA[locale]?.direction, actual: seo.direction });
  if (locale !== 'en' && seo.title.trim() === tool.title.trim() && seo.description.trim() === tool.description.trim()) fail('localized-seo', `Localized SEO collapsed to the English registry baseline for ${tool.id}/${locale}.`);
}

for (const relative of sourceRecords.filter(({ relative }) => relative.startsWith('src/routes/') && relative.endsWith('.tsx') && relative !== 'src/routes/__root.tsx').map(({ relative }) => relative)) {
  const source = fs.readFileSync(path.resolve(relative), 'utf8');
  if (/\bcreate(?:Root)?Route\s*\(/u.test(source) && !hasRouteSeoMetadata(source)) fail('route-seo', `Route is missing explicit SEO title/description metadata: ${relative}.`);
}

const swSource = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
if (swSource.includes("caches.match('/en')")) fail('service-worker', 'Service worker must not use a static /en offline fallback.');
if (!swSource.includes('BUILD_COMMIT') || !swSource.includes('flixo-shell-${BUILD_COMMIT}')) fail('service-worker', 'Service worker cache name must be bound to BUILD_COMMIT.');
const vercelSource = fs.readFileSync(path.resolve('vercel.json'), 'utf8');
if (/connect-src[^;]*\bhttps:\s*;/u.test(vercelSource)) fail('csp', 'CSP connect-src must not permit arbitrary HTTPS origins.');

const routeEntryModules = new Set([routeTreePath, rootRoutePath]); const reachableRouteModules = listReachableRouteModules([...routeEntryModules]);
const orphanRouteFiles = routeFiles.filter((file) => !reachableRouteModules.has(file)).map((file) => path.relative(process.cwd(), file).split(path.sep).join('/')).sort();
if (orphanRouteFiles.length) fail('orphan-route-files', 'Unreferenced route files exist under src/routes/.', { orphanRouteFiles, routeFileCount: routeFiles.length });

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
console.log('DOM locale owner: synchronous bootstrap + TanStack Router lifecycle');
console.log('post-render localization observers for locale state: forbidden');
console.log('lazy route Suspense: enabled');
console.log('resource owner enforcement: enabled');
console.log('async cancellation enforcement: enabled');
console.log('DOM security enforcement: enabled');
console.log('service-worker build identity enforcement: enabled');
console.log('CSP connect-src enforcement: enabled');