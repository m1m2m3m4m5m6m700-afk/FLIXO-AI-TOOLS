import { readFileSync } from 'node:fs';

const familySources = [readFileSync('src/config/tool-definitions/image.ts', 'utf8')].join('\n');
const manifestSource = readFileSync('src/lib/seo/tool-manifests.ts', 'utf8');
const catalogSource = readFileSync('src/lib/seo/tool-catalog.ts', 'utf8');
const typeSource = readFileSync('src/lib/seo/tool-manifest.ts', 'utf8');
const configSource = readFileSync('src/lib/i18n/config.ts', 'utf8');

const expectedLocales = configSource.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]
  ?.match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];
const readyToolIds = [...familySources.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);
const requiredFields = ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText'];

function fail(message) {
  console.error(`SEO manifest validation failed: ${message}`);
  process.exit(1);
}

if (expectedLocales.length !== 20) fail(`canonical locale registry must contain exactly 20 locales, found ${expectedLocales.length}.`);
if (new Set(expectedLocales).size !== expectedLocales.length) fail('canonical locale registry contains duplicates.');
if (readyToolIds.length === 0) fail('No ready image tools discovered.');
if (new Set(readyToolIds).size !== readyToolIds.length) fail('Duplicate ready image tool ids detected.');
if (/src\/config\/tool-definitions\/(pdf|audio|video|ai|other)\.ts/.test(familySources)) fail('Legacy non-image family reference detected.');
if (!manifestSource.includes('buildAllToolSeoManifests(getReadyToolConfigs())')) fail('all ready image tools are not connected to the SEO manifest generator.');
if (!catalogSource.includes("seoStatus: 'complete'")) fail('complete SEO status is not present in the manifest generator.');
if (!typeSource.includes('seoLocales: Readonly<Record<Locale, LocalizedToolSeo>>')) fail('SEO locale contract is still optional; every locale must be required.');
if (!catalogSource.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) fail('catalog does not generate a payload for every canonical locale.');
if (/(ToolCategory|category)[^\n]*(AI|Other)/.test(catalogSource)) fail('SEO catalog still exposes legacy AI/Other taxonomy.');

const coreBlock = catalogSource.match(/const CORE: Record<Locale, \{([\s\S]*?)\n\}> = \{([\s\S]*?)\n\};/);
if (!coreBlock) fail('CORE locale catalog is missing or malformed.');
let previousIndex = -1;
for (const locale of expectedLocales) {
  const marker = `${locale}: {`;
  const index = coreBlock[2].indexOf(marker);
  if (index === -1) fail(`SEO UI/SEO copy is missing locale ${locale}.`);
  if (index <= previousIndex) fail(`CORE SEO locale order drift at ${locale}.`);
  previousIndex = index;
}

for (const field of requiredFields) {
  if (!catalogSource.includes(`${field}:`)) fail(`generated SEO catalog does not define ${field}.`);
}

console.log(`SEO manifest validation passed: ${readyToolIds.length} ready image tools × ${expectedLocales.length} canonical locales with required ${requiredFields.length}-field SEO payloads.`);
