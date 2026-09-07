import { readFileSync } from 'node:fs';

const familySources = [
  'src/config/tool-definitions/image.ts',
  'src/config/tool-definitions/pdf.ts',
  'src/config/tool-definitions/audio.ts',
  'src/config/tool-definitions/video.ts',
  'src/config/tool-definitions/ai.ts',
  'src/config/tool-definitions/other.ts',
].map((path) => readFileSync(path, 'utf8')).join('\n');
const manifestSource = readFileSync('src/lib/seo/tool-manifests.ts', 'utf8');
const catalogSource = readFileSync('src/lib/seo/tool-catalog.ts', 'utf8');
const typeSource = readFileSync('src/lib/seo/tool-manifest.ts', 'utf8');
const localeSource = readFileSync('src/lib/i18n/config.ts', 'utf8');

const expectedLocales = [...(localeSource.match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1]?.matchAll(/['"]([a-z]{2})['"]/gu) ?? [])].map((match) => match[1]);
const readyToolIds = [...familySources.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);
const requiredFields = ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText'];

function fail(message) {
  console.error(`SEO manifest validation failed: ${message}`);
  process.exit(1);
}

if (expectedLocales.length !== 20) fail(`Canonical locale registry count=${expectedLocales.length}; expected 20.`);
if (readyToolIds.length === 0) fail('No ready tools discovered in registry v2 family files');
if (new Set(readyToolIds).size !== readyToolIds.length) fail('Duplicate ready tool ids detected.');
if (!manifestSource.includes('buildAllToolSeoManifests(getReadyToolConfigs())')) fail('all ready tools are not connected to the SEO manifest generator.');
if (!catalogSource.includes("seoStatus: 'complete'")) fail('complete SEO status is not present in the manifest generator.');
if (!typeSource.includes('seoLocales: Readonly<Record<Locale, LocalizedToolSeo>>')) fail('SEO locale contract is still optional for complete manifests.');
if (!catalogSource.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) fail('catalog does not generate a payload for every canonical locale.');

const coreBlock = catalogSource.match(/const CORE: Record<Locale, \{([\s\S]*?)\n\}> = \{([\s\S]*?)\n\};/);
if (!coreBlock) fail('CORE locale catalog is missing or malformed.');
for (const locale of expectedLocales) {
  if (!new RegExp(`\\b${locale}: \\{`).test(coreBlock[2])) fail(`SEO UI/SEO copy is missing locale ${locale}.`);
}

if (/\b(?:zh|ur):\s*\{/u.test(coreBlock[2])) fail('Legacy zh/ur SEO locale rows must not be public catalog locales.');

for (const field of requiredFields) {
  if (!catalogSource.includes(`${field}:`)) fail(`generated SEO catalog does not define ${field}.`);
}

console.log(`SEO manifest validation passed: ${readyToolIds.length} ready tools × ${expectedLocales.length} canonical locales with required ${requiredFields.length}-field SEO payloads.`);
