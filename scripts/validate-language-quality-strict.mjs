import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const locales = [...CANONICAL_LOCALES];
const nonEnglish = locales.filter((locale) => locale !== 'en');
const errors = [];
const report = (message) => errors.push(message);
const allowedSameAsEnglish = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K']);
const nonTranslatableKeys = new Set(['dir', 'direction', 'locale', 'localeCode', 'lang', 'languageCode']);
const expectedScript = Object.freeze({
  ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ru: /[\u0400-\u04ff]/u,
  zh: /[\u3400-\u9fff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u,
  hi: /[\u0900-\u097f]/u,
  th: /[\u0e00-\u0e7f]/u,
});

const normalize = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const leaves = (value, path = []) => {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
};
const isNonTranslatablePath = (path) => path.split('.').some((segment) => nonTranslatableKeys.has(segment));
const compareShapeAndValues = (english, localized, context) => {
  if (typeof english !== typeof localized) {
    report(`${context}: type mismatch (${typeof english} vs ${typeof localized})`);
    return;
  }
  if (Array.isArray(english)) {
    if (!Array.isArray(localized)) {
      report(`${context}: array/object type mismatch`);
      return;
    }
    const englishItemsAreObjects = english.some((value) => value && typeof value === 'object' && !Array.isArray(value));
    const localizedItemsAreObjects = localized.some((value) => value && typeof value === 'object' && !Array.isArray(value));
    if (englishItemsAreObjects !== localizedItemsAreObjects) {
      report(`${context}: array item shape mismatch`);
      return;
    }
    if (englishItemsAreObjects && english.length !== localized.length) report(`${context}: structured array length mismatch (${english.length} vs ${localized.length})`);
    const comparableLength = Math.min(english.length, localized.length);
    for (let index = 0; index < comparableLength; index += 1) compareShapeAndValues(english[index], localized[index], `${context}.${index}`);
    return;
  }
  if (english && typeof english === 'object') {
    if (!localized || typeof localized !== 'object' || Array.isArray(localized)) {
      report(`${context}: object shape mismatch`);
      return;
    }
    const enKeys = Object.keys(english).sort();
    const locKeys = Object.keys(localized).sort();
    for (const key of enKeys) if (!(key in localized)) report(`${context}: missing key ${key}`);
    for (const key of locKeys) if (!(key in english)) report(`${context}: unexpected key ${key}`);
    for (const key of enKeys) if (key in localized) compareShapeAndValues(english[key], localized[key], `${context}.${key}`);
  }
};
const compareLeaves = (english, localized, context) => {
  const enLeaves = leaves(english);
  const locLeaves = leaves(localized);
  for (const leaf of locLeaves) {
    if (isNonTranslatablePath(leaf.path)) continue;
    if (!leaf.value.trim()) report(`${context}: empty translation at ${leaf.path}`);
    const en = enLeaves.find((candidate) => candidate.path === leaf.path);
    if (en && en.value === leaf.value && !allowedSameAsEnglish.has(normalize(leaf.value))) report(`${context}: exact English fallback at ${leaf.path}: ${JSON.stringify(leaf.value)}`);
    const enTags = [...(en?.value ?? '').matchAll(/<[^>]+>/gu)].map((match) => match[0]);
    const locTags = [...leaf.value.matchAll(/<[^>]+>/gu)].map((match) => match[0]);
    if (en && enTags.join('|') !== locTags.join('|')) report(`${context}: HTML tag structure mismatch at ${leaf.path}`);
    const enPlaceholders = [...(en?.value ?? '').matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((match) => match[0]);
    const locPlaceholders = [...leaf.value.matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((match) => match[0]);
    if (en && enPlaceholders.join('|') !== locPlaceholders.join('|')) report(`${context}: placeholder structure mismatch at ${leaf.path}`);
  }
};
const importModule = async (relativePath) => import(pathToFileURL(`${root}/${relativePath}`).href);

const configModule = await importModule('src/lib/i18n/config.ts');
const configuredLocales = [...(configModule.LOCALES ?? [])];
if (configuredLocales.join('|') !== locales.join('|')) report(`Runtime locale registry drift: ${configuredLocales.join(', ')}`);
for (const locale of locales) {
  const metadata = configModule.LOCALE_METADATA?.[locale];
  if (!metadata) report(`Missing runtime locale metadata: ${locale}`);
  else if (metadata.direction !== (locale === 'ar' ? 'rtl' : 'ltr')) report(`Direction mismatch: ${locale}`);
}

const homeModule = await importModule('src/data/home-locales.ts');
const quickModule = await importModule('src/data/quickflow-locales.ts');
const overridesModule = await importModule('src/lib/i18n/locale-quality-overrides.ts');
const toolUiModule = await importModule('src/data/tool-ui-i18n.ts');
const effectiveHome = (locale) => ({ ...(homeModule.getHomeCopy?.(locale) ?? homeModule.HOME_I18N?.[locale] ?? {}), ...(overridesModule.HOME_COPY_OVERRIDES?.[locale] ?? {}) });
const effectiveQuick = (locale) => ({ ...(quickModule.QUICKFLOW_LOCALES?.[locale] ?? {}), ...(overridesModule.QUICKFLOW_COPY_OVERRIDES?.[locale] ?? {}) });

const effectivePairs = [
  ['HOME', effectiveHome],
  ['QUICKFLOW', effectiveQuick],
];
for (const [name, resolve] of effectivePairs) {
  const english = resolve('en');
  if (!english || !Object.keys(english).length) {
    report(`${name}: English effective baseline missing`);
    continue;
  }
  for (const locale of nonEnglish) {
    const localized = resolve(locale);
    if (!localized || !Object.keys(localized).length) {
      report(`${name}: missing effective runtime locale ${locale}`);
      continue;
    }
    compareShapeAndValues(english, localized, `${name}/${locale}`);
    compareLeaves(english, localized, `${name}/${locale}`);
  }
}

const coreEnglishModule = await importModule('src/lib/i18n/locales/en.ts');
for (const locale of locales) {
  const dictionaryModule = await importModule(`src/lib/i18n/locales/${locale}.ts`);
  const dictionary = dictionaryModule?.[locale];
  if (!dictionary) {
    report(`CORE_DICTIONARY: missing locale export ${locale}`);
    continue;
  }
  if (dictionary.locale !== locale) report(`CORE_DICTIONARY/${locale}: locale identity mismatch`);
  if (dictionary.direction !== configModule.LOCALE_METADATA?.[locale]?.direction) report(`CORE_DICTIONARY/${locale}: direction mismatch`);
  compareShapeAndValues(coreEnglishModule.en, dictionary, `CORE_DICTIONARY/${locale}`);
  compareLeaves(coreEnglishModule.en, dictionary, `CORE_DICTIONARY/${locale}`);
  const script = expectedScript[locale];
  if (script) {
    for (const { path, value } of leaves(dictionary)) {
      if (isNonTranslatablePath(path)) continue;
      const text = normalize(value);
      const letters = [...text].filter((char) => /\p{L}/u.test(char));
      if (letters.length < 4 || script.test(text)) continue;
      if (/^(?:FLIXO|QuickFlow|OCR|PDF|English|العربية|Smart Intent|Ctrl K)/u.test(text)) continue;
      report(`CORE_DICTIONARY/${locale}: expected ${locale} script missing at ${path}: ${JSON.stringify(text)}`);
    }
  }
}

for (const locale of locales) {
  const ui = toolUiModule.TOOL_UI_I18N?.[locale];
  const englishUi = toolUiModule.TOOL_UI_I18N?.en;
  if (!ui) {
    report(`TOOL_UI_I18N: missing runtime locale ${locale}`);
    continue;
  }
  if (!englishUi) {
    report('TOOL_UI_I18N: English baseline missing');
    break;
  }
  compareShapeAndValues(englishUi, ui, `TOOL_UI_I18N/${locale}`);
  compareLeaves(englishUi, ui, `TOOL_UI_I18N/${locale}`);
}

const seoModule = await importModule('src/lib/seo/tool-seo.ts');
const readyTools = [...(seoModule.getReadyToolsForSeo?.() ?? [])];
if (!readyTools.length) report('SEO runtime contract exposed no ready tools');
const siteOrigin = configModule.SITE_ORIGIN;
for (const locale of locales) {
  for (const tool of readyTools) {
    const seo = seoModule.getToolSeo?.(locale, tool.id);
    if (!seo) {
      report(`${tool.id}/seo: runtime SEO missing for locale ${locale}`);
      continue;
    }
    if (!normalize(seo.title) || !normalize(seo.description) || !normalize(seo.intro)) report(`${tool.id}/seo/${locale}: required localized SEO text is empty`);
    if (!Array.isArray(seo.howTo) || !seo.howTo.length || seo.howTo.some((value) => !normalize(value))) report(`${tool.id}/seo/${locale}: runtime howTo contract is incomplete`);
    if (!Array.isArray(seo.features) || !seo.features.length || seo.features.some((value) => !normalize(value))) report(`${tool.id}/seo/${locale}: runtime features contract is incomplete`);
    if (!Array.isArray(seo.altText) || !seo.altText.length || seo.altText.some((value) => !normalize(value))) report(`${tool.id}/seo/${locale}: runtime altText contract is incomplete`);
    if (seo.languageTag !== configModule.LOCALE_METADATA?.[locale]?.languageTag) report(`${tool.id}/seo/${locale}: languageTag drift`);
    if (seo.direction !== configModule.LOCALE_METADATA?.[locale]?.direction) report(`${tool.id}/seo/${locale}: direction drift`);
    if (seo.alternates?.length !== locales.length) report(`${tool.id}/seo/${locale}: expected ${locales.length} hreflang alternates, found ${seo.alternates?.length ?? 0}`);
    try {
      const url = new URL(seo.url);
      if (url.origin !== siteOrigin) report(`${tool.id}/seo/${locale}: canonical origin drift ${seo.url} (expected ${siteOrigin})`);
      if (url.pathname !== seo.path) report(`${tool.id}/seo/${locale}: canonical path mismatch ${seo.path} vs ${url.pathname}`);
    } catch {
      report(`${tool.id}/seo/${locale}: invalid canonical URL ${seo.url}`);
    }
    if (locale === 'ms' || locale === 'uk') {
      const sampleText = normalize([seo.title, seo.description, seo.intro, ...seo.howTo, ...seo.features, ...seo.altText].join(' '));
      if (sampleText === normalize([tool.title, tool.description].join(' '))) report(`${tool.id}/seo/${locale}: locale-specific runtime copy collapsed to English baseline`);
    }
  }
}

if (errors.length) {
  console.error(`STRICT LANGUAGE QUALITY GATE FAILED — ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`STRICT LANGUAGE QUALITY GATE PASSED — ${locales.length} locales; effective Home/QuickFlow, core dictionaries, Tool UI, runtime SEO locale completeness, canonical URL provenance, fallback rejection, script/direction checks, and placeholder/HTML integrity are clean.`);
