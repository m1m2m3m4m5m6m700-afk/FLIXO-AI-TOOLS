import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const locales = CANONICAL_LOCALES;
const read = (path) => readFileSync(path, 'utf8');

const config = read(`${root}/src/lib/i18n/config.ts`);
const expectedLocales = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
if (expectedLocales.length !== locales.length || expectedLocales.some((value, index) => value !== locales[index])) {
  fail(`Locale registry drift: expected ${locales.length} canonical locales, found ${expectedLocales.join(', ')}`);
}

for (const locale of locales) {
  const localePath = `${root}/src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(localePath)) {
    fail(`Missing locale dictionary: ${locale}`);
    continue;
  }
  const source = read(localePath);
  if (!source.includes(`locale: '${locale}'`)) fail(`${locale}: locale identifier mismatch`);
  if (!/homeTitle:\s*'[^']+'/u.test(source)) fail(`${locale}: missing homeTitle`);
  if (!/homeDescription:\s*'[^']+'/u.test(source)) fail(`${locale}: missing homeDescription`);
}

const home = read(`${root}/src/data/home-locales.ts`);
const quickflow = read(`${root}/src/data/quickflow-locales.ts`);
const toolUi = read(`${root}/src/data/tool-ui-i18n.ts`);
const overrides = read(`${root}/src/lib/i18n/locale-quality-overrides.ts`);

const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
const quickflowKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const toolUiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];

const runtimeI18n = await import(pathToFileURL(`${root}/src/lib/i18n/locale-quality-overrides.ts`).href);
const seoResolver = await import(pathToFileURL(`${root}/src/config/tool-seo-name-resolver.ts`).href);
const seoLocalization = await import(pathToFileURL(`${root}/src/lib/i18n/tool-seo-localization.ts`).href);

const homeOverride = (locale) => runtimeI18n.HOME_COPY_OVERRIDES[locale] ?? {};
const quickOverride = (locale) => runtimeI18n.QUICKFLOW_COPY_OVERRIDES[locale] ?? {};
const homeKeyName = (key) => key.slice(0, -1);

const entryBody = (source, locale, marker) => {
  const startPattern = new RegExp(`\\b${locale}:\\s*${marker}\\(\\{`, 'u');
  const match = startPattern.exec(source);
  if (!match) return '';
  const start = match.index + match[0].length;
  const endPattern = /\n\s*[a-z]{2}:\s*(?:copy|q)\(\{/gu;
  endPattern.lastIndex = start;
  const next = endPattern.exec(source);
  const end = next ? next.index : source.indexOf('\n};', start);
  return source.slice(start, end === -1 ? source.length : end);
};

const objectBody = (source, locale) => new RegExp(`\\b${locale}:\\s*\\{([\\s\\S]*?)\\}`, 'u').exec(source)?.[1] ?? '';
const extractString = (entry, key) => entry.match(new RegExp(`${key}['"]([^'"\\n]*)['"]`, 'u'))?.[1] ?? '';

const effectiveHomeValue = (locale, key, sourceValue) => {
  const override = homeOverride(locale);
  const name = homeKeyName(key);
  const value = override[name];
  if (Array.isArray(value)) return value.map((pair) => pair.join(' — ')).join(' | ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  return sourceValue;
};

const effectiveHomeHasKey = (locale, key, sourceEntry) => Boolean(sourceEntry.includes(key)) || Object.prototype.hasOwnProperty.call(homeOverride(locale), homeKeyName(key));
const effectiveQuickHasKey = (locale, key, sourceEntry) => Boolean(sourceEntry.includes(key)) || Object.prototype.hasOwnProperty.call(quickOverride(locale), homeKeyName(key));
const effectiveQuickValue = (locale, key, sourceValue) => quickOverride(locale)[homeKeyName(key)] ?? sourceValue;

for (const locale of locales) {
  const homeEntry = entryBody(home, locale, 'copy');
  if (!homeEntry && Object.keys(homeOverride(locale)).length === 0) fail(`Home: missing locale entry ${locale}`);
  for (const key of homeKeys) if (!effectiveHomeHasKey(locale, key, homeEntry)) fail(`Home ${locale}: missing ${key}`);

  const quickEntry = entryBody(quickflow, locale, 'q');
  if (!quickEntry && Object.keys(quickOverride(locale)).length === 0) fail(`QuickFlow: missing locale entry ${locale}`);
  for (const key of quickflowKeys) if (!effectiveQuickHasKey(locale, key, quickEntry)) fail(`QuickFlow ${locale}: missing ${key}`);

  const uiEntry = objectBody(toolUi, locale);
  if (!uiEntry) fail(`Tool UI: missing locale entry ${locale}`);
  else for (const key of toolUiKeys) if (!uiEntry.includes(key)) fail(`Tool UI ${locale}: missing ${key}`);
}

const englishHome = entryBody(home, 'en', 'copy');
const englishQuick = entryBody(quickflow, 'en', 'q');
const englishLeakKeys = ['badge:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:', 'browserMeta:'];

for (const locale of locales.filter((value) => value !== 'en')) {
  const entry = entryBody(home, locale, 'copy');
  for (const key of englishLeakKeys) {
    const enValue = extractString(englishHome, key);
    const localizedValue = effectiveHomeValue(locale, key, extractString(entry, key));
    if (enValue && localizedValue === enValue) fail(`Home ${locale}: English fallback in ${key}`);
  }

  const quick = entryBody(quickflow, locale, 'q');
  for (const key of quickflowKeys) {
    const enValue = extractString(englishQuick, key);
    const localizedValue = effectiveQuickValue(locale, key, extractString(quick, key));
    if (enValue && localizedValue === enValue && key !== 'resultAlt:') fail(`QuickFlow ${locale}: English fallback in ${key}`);
  }
}

const htmlSource = extractString(englishHome, 'heroTitle:');
for (const locale of locales) {
  const entry = entryBody(home, locale, 'copy');
  const localizedHero = effectiveHomeValue(locale, 'heroTitle:', extractString(entry, 'heroTitle:'));
  if ((htmlSource.includes('<span>') && !localizedHero.includes('<span>')) || (htmlSource.includes('</span>') && !localizedHero.includes('</span>'))) {
    fail(`Home ${locale}: heroTitle HTML emphasis structure differs from English`);
  }
}

for (const locale of locales) {
  const metadata = new RegExp(`${locale}:\\s*\\{[^}]*direction:\\s*'([^']+)'`, 'u').exec(config)?.[1];
  const shouldBeRtl = locale === 'ar' || locale === 'ur';
  if ((metadata === 'rtl') !== shouldBeRtl) fail(`Direction mismatch for ${locale}: expected ${shouldBeRtl ? 'rtl' : 'ltr'}, found ${metadata ?? '<missing>'}`);
}

const toolSeoEntries = Object.entries(seoLocalization.TOOL_SEO_NAMES ?? {});
if (!toolSeoEntries.length) fail('No TOOL_SEO_NAMES entries found');
for (const [toolId, translations] of toolSeoEntries) {
  for (const locale of locales) {
    const value = translations?.[locale];
    if (typeof value === 'string' && value.trim()) continue;
    if (locale === 'ms' || locale === 'uk') {
      const authoritative = seoResolver.getAuthoritativeToolSeoName({ id: toolId, title: toolId }, locale);
      if (typeof authoritative === 'string' && authoritative.trim() && authoritative.toLowerCase() !== toolId.toLowerCase()) continue;
    }
    fail(`SEO name entry ${toolId}: missing ${locale}`);
  }
}

const reviewedHomePhraseReplacements = Object.freeze({
  sv: Object.freeze({
    'Smart routing': 'Smart dirigering',
  }),
});
const suspiciousTerms = ['Privacy-first', 'Browser-first', 'Instant start', 'Smart routing', 'Open smart command palette', 'Start with the tools people actually need.'];
for (const locale of locales.filter((value) => value !== 'en')) {
  const entry = entryBody(home, locale, 'copy');
  const reviewed = reviewedHomePhraseReplacements[locale] ?? {};
  for (const term of suspiciousTerms) {
    const rawLocalized = entry.includes(`'${term}'`) || entry.includes(`"${term}"`);
    if (!rawLocalized) continue;
    const replacement = reviewed[term];
    if (replacement && overrides.includes(replacement)) continue;
    fail(`Home ${locale}: suspicious English phrase leaked: ${term}`);
  }
}

if (errors.length) {
  console.error(`Language quality gate failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Language quality gate passed: ${locales.length} locales; effective Home/QuickFlow/Tool UI output, locale dictionaries, RTL/LTR, SEO-name completeness, and English-leak checks are clean.`);
