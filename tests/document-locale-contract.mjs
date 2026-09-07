import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const runtimeLocalePath = new URL('../src/lib/i18n/runtime-document-locale.ts', import.meta.url);
assert.equal(existsSync(runtimeLocalePath), true, 'canonical document-locale writer must exist');

const runtimeLocale = read('src/lib/i18n/runtime-document-locale.ts');
assert.match(runtimeLocale, /export function localeFromPathname\(/u);
assert.match(runtimeLocale, /export function applyDocumentLocale\(/u);
assert.doesNotMatch(runtimeLocale, /new\s+MutationObserver\s*\(/u, 'document locale ownership must not use MutationObserver');
assert.doesNotMatch(runtimeLocale, /\bsetInterval\s*\(/u, 'document locale ownership must not poll');
assert.doesNotMatch(runtimeLocale, /\brequestAnimationFrame\s*\(/u, 'document locale ownership must not schedule repair frames');

const main = read('src/main.tsx');
assert.match(main, /import \{ applyDocumentLocale, localeFromPathname \} from ['"]\.\/lib\/i18n\/runtime-document-locale['"]/u);
assert.match(main, /applyDocumentLocale\(localeFromPathname\(window\.location\.pathname\)\)/u);
assert.doesNotMatch(main, /installToolUiRuntimeSupplement/u, 'removed supplement runtime must not be reintroduced');

const rootRoute = read('src/routes/__root.tsx');
assert.match(rootRoute, /useLayoutEffect\(/u);
assert.match(rootRoute, /applyDocumentLocale\(localeFromPathname\(location\.pathname\)\)/u);
assert.match(rootRoute, /<RouteErrorBoundary>[\s\S]*<RouteContent \/><\/RouteErrorBoundary>/u);
assert.match(rootRoute, /errorComponent:\s*ErrorComponent/u);
assert.match(rootRoute, /notFoundComponent:\s*NotFoundComponent/u);

const localizedRoute = read('src/routes/localized-tool.tsx');
assert.match(localizedRoute, /errorComponent:\s*ErrorComponent/u);
assert.match(localizedRoute, /notFoundComponent:\s*NotFoundComponent/u);

const index = read('index.html');
assert.match(index, /data-flixo-locale/u, 'index.html must preserve synchronous bootstrap locale ownership');
assert.match(index, /localeMap/u, 'index.html must derive bootstrap locale from the canonical locale map');
assert.doesNotMatch(index, /new\s+MutationObserver\s*\(/u, 'index.html must not repair locale with an observer');

console.log('G4 document-locale architecture contract PASS');
