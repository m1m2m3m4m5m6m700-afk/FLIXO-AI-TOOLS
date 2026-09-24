#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const canonicalLocales = ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'];
const loader = readFileSync('src/lib/i18n/tool-ui-loader.ts', 'utf8');
const route = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');
const facade = readFileSync('src/data/tool-ui-i18n.ts', 'utf8');
const fallback = readFileSync('src/data/tool-ui-fallback.ts', 'utf8');

for (const locale of canonicalLocales) {
  assert.ok(existsSync(`src/data/tool-ui-locales/${locale}.ts`), `missing Tool UI locale module: ${locale}`);
  assert.match(loader, new RegExp(`@/data/tool-ui-locales/${locale}\\\\['"]`), `missing dynamic import: ${locale}`);
}

assert.match(loader, /const cache = new Map<Locale, Promise<ToolUiCopy>>/u);
assert.match(loader, /resolvedCache = new Map<Locale, ToolUiCopy>/u);
assert.match(route, /use\(loadToolUiCopy\(locale\)\)/u);
assert.doesNotMatch(route, /TOOL_UI_I18N/u);
assert.doesNotMatch(facade, /Record<Locale,\s*ToolUiCopy>/u);
assert.doesNotMatch(facade, /\ben:\s*\{/u);
assert.match(fallback, /TOOL_UI_FALLBACK/);

console.log(`TOOL_UI_LAZY_BOUNDARY=PASS locales=${canonicalLocales.length}`);
console.log('TOOL_UI_PROMISE_CACHE=PASS');
console.log('TOOL_UI_ROUTE_STATIC_MONOLITH=ABSENT');
