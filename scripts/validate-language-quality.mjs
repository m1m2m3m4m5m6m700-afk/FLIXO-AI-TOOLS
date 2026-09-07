import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const locales = CANONICAL_LOCALES;
const read = (path) => readFileSync(path, 'utf8');

const config = read(`${root}/src/lib/i18n/config.ts`);
const expectedLocales = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
if (expectedLocales.length !== locales.length || expectedLocales.some((value, index) => value !== locales[index])) fail(`Locale registry drift: expected ${locales.length} canonical locales, found ${expectedLocales.join(', ')}`);

for (const locale of locales) {
  const localePath = `${root}/src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(localePath)) { fail(`Missing locale dictionary: ${locale}`); continue; }
  const source = read(localePath);
  if (!source.includes(`locale: '${locale}'`)) fail(`${locale}: locale identifier mismatch`);
  if (!/homeTitle:\s*'[^']+'/u.test(source)) fail(`${locale}: missing homeTitle`);
  if (!/homeDescription:\s*'[^']+'/u.test(source)) fail(`${locale}: missing homeDescription`);
}

const home = read(`${root}/src/data/home-locales.ts`);
const quickflow = read(`${root}/src/data/quickflow-locales.ts`);
const toolUi = read(`${root}/src/data/tool-ui-i18n.ts`);
const catalog = read(`${root}/src/lib/seo/tool-catalog.ts`);
const resolver = read(`${root}/src/config/tool-seo-name-resolver.ts`);

const requiredHomeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
const requiredQuickKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const requiredToolUiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];

const entryBody = (source, locale, marker) => new RegExp(`\\b${locale}:\\s*${marker}\\(\\{([\\s\\S]*?)\\}\\)`, 'u').exec(source)?.[1] ?? '';
const objectBody = (source, locale) => new RegExp(`\\b${locale}:\\s*\\{([\\s\\S]*?)\\}`, 'u').exec(source)?.[1] ?? '';
const extract = (entry, key) => entry.match(new RegExp(`${key}\\s*['"]([^'"\\n]*)['"]`, 'u'))?.[1] ?? '';

for (const locale of locales) {
  const homeEntry = entryBody(home, locale, 'copy');
  if (!homeEntry) fail(`Home: missing locale entry ${locale}`); else for (const key of requiredHomeKeys) if (!homeEntry.includes(key)) fail(`Home ${locale}: missing ${key}`);
  const quickEntry = entryBody(quickflow, locale, 'q');
  if (!quickEntry) fail(`QuickFlow: missing locale entry ${locale}`); else for (const key of requiredQuickKeys) if (!quickEntry.includes(key)) fail(`QuickFlow ${locale}: missing ${key}`);
  const uiEntry = objectBody(toolUi, locale);
  if (!uiEntry) fail(`Tool UI: missing locale entry ${locale}`); else for (const key of requiredToolUiKeys) if (!uiEntry.includes(key)) fail(`Tool UI ${locale}: missing ${key}`);
  if (!new RegExp(`\\b${locale}:`, 'u').test(catalog)) fail(`SEO catalog: missing locale ${locale}`);
}

const englishHome = entryBody(home, 'en', 'copy');
const englishQuick = entryBody(quickflow, 'en', 'q');
const leakKeys = ['heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:', 'browserMeta:'];
for (const locale of locales.filter((value) => value !== 'en')) {
  const homeEntry = entryBody(home, locale, 'copy');
  for (const key of leakKeys) { const en = extract(englishHome, key); const localized = extract(homeEntry, key); if (en && localized === en) fail(`Home ${locale}: English fallback in ${key}`); }
  const quickEntry = entryBody(quickflow, locale, 'q');
  for (const key of requiredQuickKeys) { const en = extract(englishQuick, key); const localized = extract(quickEntry, key); if (en && localized === en && key !== 'resultAlt:') fail(`QuickFlow ${locale}: English fallback in ${key}`); }
}

for (const locale of locales) {
  const metadata = new RegExp(`${locale}:\\s*\\{[^}]*direction:\\s*'([^']+)'`, 'u').exec(config)?.[1];
  if ((metadata === 'rtl') !== (locale === 'ar')) fail(`Direction mismatch for ${locale}: found ${metadata ?? '<missing>'}`);
}

if (!catalog.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) fail('SEO catalog is not generated from the canonical locale set.');
if (!resolver.includes('buildLocalizedToolSeo(tool, locale)')) fail('Authoritative SEO resolver is not connected to the canonical SEO catalog.');
if (!catalog.includes("seoStatus: 'complete'")) fail('SEO catalog does not mark generated manifests complete.');

if (errors.length) {
  console.error(`Language quality gate failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Language quality gate passed: ${locales.length} canonical locales; dictionaries, Home/QuickFlow/Tool UI coverage, RTL/LTR, SEO catalog, and English-leak checks are clean.`);
