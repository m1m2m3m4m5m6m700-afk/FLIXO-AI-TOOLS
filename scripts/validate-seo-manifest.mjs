import { readFileSync } from 'node:fs';
import { LOCALES } from '../src/lib/i18n/config.ts';

const familySource = readFileSync('src/config/canonical-tool-definition.ts', 'utf8');
const manifestSource = readFileSync('src/lib/seo/tool-manifests.ts', 'utf8');
const catalogSource = readFileSync('src/lib/seo/tool-catalog.ts', 'utf8');
const typeSource = readFileSync('src/lib/seo/tool-manifest.ts', 'utf8');

const expectedLocales = [...LOCALES];
const readyToolIds = [...familySource.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);
const requiredFields = ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText'];

function fail(message) {
  console.error(`SEO manifest validation failed: ${message}`);
  process.exit(1);
}

if (readyToolIds.length === 0) fail('No ready image tools discovered in canonical tool definitions');
if (new Set(readyToolIds).size !== readyToolIds.length) fail('Duplicate ready image tool ids detected.');
if (!manifestSource.includes('buildAllToolSeoManifests(getReadyToolConfigs())')) fail('all ready image tools are not connected to the SEO manifest generator.');
if (!catalogSource.includes("seoStatus: 'complete'")) fail('complete SEO status is not present in the manifest generator.');
if (!typeSource.includes('seoLocales: Readonly<Record<string, LocalizedToolSeo>>')) fail('SEO manifest type is missing its localized payload map.');
if (!typeSource.includes('assertCompleteToolSeoLocales')) fail('canonical locale completeness validator is missing.');
if (!catalogSource.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) fail('catalog does not generate a payload for every canonical locale.');

const coreBlock = catalogSource.match(/const CORE: Record<Locale, \{([\s\S]*?)\n\}> = \{([\s\S]*?)\n\};/);
if (!coreBlock) fail('CORE locale catalog is missing or malformed.');
for (const locale of expectedLocales) {
  if (!new RegExp(`\\b${locale}: \\{`).test(coreBlock[2])) fail(`SEO UI/SEO copy is missing canonical locale ${locale}.`);
}

for (const field of requiredFields) {
  if (!catalogSource.includes(`${field}:`)) fail(`generated SEO catalog does not define ${field}.`);
}

console.log(`SEO manifest validation passed: ${readyToolIds.length} ready image tools × ${expectedLocales.length} canonical locales with required ${requiredFields.length}-field SEO payloads.`);