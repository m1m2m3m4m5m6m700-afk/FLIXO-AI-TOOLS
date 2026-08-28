import { existsSync, readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`GOOGLE MULTILINGUAL SEO FAIL: ${message}`);
  process.exit(1);
};
const pass = (message) => console.log(`GOOGLE MULTILINGUAL SEO PASS: ${message}`);

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const sitemap = readFileSync('public/sitemap.xml', 'utf8');
const manifest = readFileSync('public/manifest.webmanifest', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');
const indexing = readFileSync('scripts/validate-indexing.mjs', 'utf8');
const sitemapGenerator = readFileSync('scripts/generate-sitemap.mjs', 'utf8');

const expectedLocales = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'];
const localeMatch = config.match(/export const LOCALES = \[([^\]]+)\]/u);
if (!localeMatch) fail('LOCALES is not statically declared in the canonical i18n config.');
const locales = [...localeMatch[1].matchAll(/['"]([a-z]{2}(?:-[A-Z]{2})?)['"]/gu)].map((m) => m[1]);
if (locales.length !== 20) fail(`expected exactly 20 canonical locales, found ${locales.length}`);
if (new Set(locales).size !== locales.length) fail('duplicate locale identifiers detected.');
if (locales.join('|') !== expectedLocales.join('|')) fail(`canonical locale order/set drifted: ${locales.join(', ')}`);
pass('canonical 20-locale registry');

const metadataEntries = [...config.matchAll(/([a-z]{2}): \{ languageTag: '([^']+)', direction: '(ltr|rtl)' \}/gu)];
if (metadataEntries.length !== 20) fail(`expected 20 locale metadata entries, found ${metadataEntries.length}`);
const metadata = new Map(metadataEntries.map((m) => [m[1], { languageTag: m[2], direction: m[3] }]));
for (const locale of locales) {
  const entry = metadata.get(locale);
  if (!entry) fail(`missing locale metadata for ${locale}`);
  if (!entry.languageTag) fail(`missing languageTag for ${locale}`);
  if (!['ltr', 'rtl'].includes(entry.direction)) fail(`invalid direction for ${locale}`);
}
if (metadata.get('ar')?.direction !== 'rtl' || metadata.get('ur')?.direction !== 'rtl') fail('RTL contract must include ar and ur.');
pass('language tags and direction contract');

if (!sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) fail('sitemap is missing XHTML hreflang namespace.');
const urlBlocks = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/gu)];
if (!urlBlocks.length) fail('sitemap contains no URL entries.');
const urls = urlBlocks.map((m) => m[1]);
if (new Set(urls).size !== urls.length) fail('sitemap contains duplicate <loc> URLs.');

const localeUrlPattern = new RegExp(`^https?://[^/]+/(?:${locales.join('|')})(?:/|$)`, 'u');
const groups = new Map();
for (const [index, match] of urlBlocks.entries()) {
  const loc = match[1];
  const body = match[2];
  const locale = loc.match(new RegExp(`^https?://[^/]+/(${locales.join('|')})(?:/|$)`, 'u'))?.[1];
  if (!locale || !localeUrlPattern.test(loc)) fail(`non-localized URL in sitemap: ${loc}`);

  const alternates = [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/gu)];
  if (alternates.length !== 21) fail(`${loc} has ${alternates.length} hreflang links; expected 20 locales + x-default.`);
  const seenTags = new Set();
  const expectedHrefs = new Map();
  for (const [, tag, href] of alternates) {
    if (seenTags.has(tag)) fail(`${loc} contains duplicate hreflang ${tag}.`);
    seenTags.add(tag);
    expectedHrefs.set(tag, href);
  }
  for (const localeCode of locales) {
    const tag = metadata.get(localeCode).languageTag;
    if (!seenTags.has(tag)) fail(`${loc} is missing hreflang=${tag}.`);
    const href = expectedHrefs.get(tag);
    if (!href || !localeUrlPattern.test(href)) fail(`${loc} has invalid hreflang target for ${tag}: ${href ?? '<missing>'}`);
  }
  if (!seenTags.has('x-default')) fail(`${loc} is missing x-default.`);
  const xDefault = expectedHrefs.get('x-default');
  if (!xDefault) fail(`${loc} is missing x-default.`);

  const pathWithoutLocale = new URL(loc).pathname.replace(new RegExp(`^/(?:${locales.join('|')})(?=/|$)`, 'u'), '') || '/';
  const expectedEnglishPath = `/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`;
  const expectedEnglishUrl = new URL(expectedEnglishPath, loc);
  const actualXDefault = new URL(xDefault);
  const normalizePath = (pathname) => pathname.replace(/\/+$/u, '') || '/';
  if (
    actualXDefault.origin !== expectedEnglishUrl.origin ||
    normalizePath(actualXDefault.pathname) !== normalizePath(expectedEnglishUrl.pathname) ||
    actualXDefault.search !== expectedEnglishUrl.search ||
    actualXDefault.hash !== expectedEnglishUrl.hash
  ) {
    fail(`${loc} x-default must target ${expectedEnglishUrl.toString()}; found ${xDefault}.`);
  }

  const canonicalTag = metadata.get(locale).languageTag;
  const selfHref = expectedHrefs.get(canonicalTag);
  if (selfHref !== loc) fail(`${loc} hreflang self-reference does not equal <loc>.`);

  const key = pathWithoutLocale.replace(/\/+$/u, '') || '/';
  if (!groups.has(key)) groups.set(key, new Map());
  groups.get(key).set(locale, loc);
  if (index < 0) fail('unreachable');
}

for (const [path, group] of groups) {
  if (group.size !== 20) fail(`localized sitemap group ${path} contains ${group.size}/20 locale URLs.`);
  for (const locale of locales) {
    if (!group.has(locale)) fail(`localized sitemap group ${path} is missing ${locale}.`);
  }
}
pass(`${groups.size} localized page families × 20 locales with symmetric hreflang`);

if (!sitemapGenerator.includes('LOCALES.map((locale)')) fail('sitemap generator does not derive alternates from the canonical locale registry.');
if (!sitemapGenerator.includes('LOCALE_METADATA[locale].languageTag')) fail('sitemap generator does not use canonical language tags.');
if (!sitemapGenerator.includes('X_DEFAULT_LOCALE')) fail('sitemap generator does not derive x-default from canonical locale config.');
if (!sitemapGenerator.includes('TOOL_MANIFEST.filter((tool) => tool.isReady)')) fail('sitemap generator is not gated by ready TOOL_MANIFEST entries.');
pass('sitemap single-source-of-truth contract');

if (!indexing.includes('xhtml:link rel="alternate" hreflang=')) fail('indexing validator does not enforce hreflang generation.');
if (!indexing.includes('hreflang="x-default"')) fail('indexing validator does not enforce x-default.');
if (!indexing.includes('20-locale hreflang is enabled')) fail('indexing validator does not certify the 20-locale contract.');
if (!rootSource.includes("name: 'robots'") || !rootSource.includes('index,follow')) fail('root route does not expose index/follow policy.');
if (!rootSource.includes("property: 'og:url'")) fail('root route lacks canonical social URL metadata.');
const manifestJson = JSON.parse(manifest);
if (manifestJson.start_url !== '/en') fail('manifest must start from the canonical localized English route /en.');
pass('indexability and social discovery contract');

const localeFiles = locales.map((locale) => `src/i18n/locales/${locale}.ts`);
const missingLocaleFiles = localeFiles.filter((file) => !existsSync(file));
if (missingLocaleFiles.length) fail(`missing locale resource files: ${missingLocaleFiles.join(', ')}`);
pass('20 locale resource files present');

console.log(`Google multilingual SEO certification passed: ${groups.size} page families, ${groups.size * 20} localized URLs, 20 canonical language variants, reciprocal hreflang, x-default, sitemap symmetry, crawl/index policy, and locale resource coverage.`);
