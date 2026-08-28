import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const locales = CANONICAL_LOCALES;
const nonEnglish = locales.filter((locale) => locale !== 'en');
const read = (path) => readFileSync(path, 'utf8');

const expectedDirection = (locale) => (locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr');
const expectedScript = Object.freeze({
  ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ru: /[\u0400-\u04ff]/u,
  zh: /[\u3400-\u9fff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u,
  hi: /[\u0900-\u097f]/u,
  th: /[\u0e00-\u0e7f]/u,
});
const allowedSameAsEnglish = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K']);

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
  const direction = /direction:\s*'([^']+)'/u.exec(source)?.[1];
  if (direction !== expectedDirection(locale)) fail(`${locale}: direction mismatch; expected ${expectedDirection(locale)}, found ${direction ?? '<missing>'}`);
}

const home = read(`${root}/src/data/home-locales.ts`);
const quickflow = read(`${root}/src/data/quickflow-locales.ts`);
const toolUi = read(`${root}/src/data/tool-ui-i18n.ts`);
const seoNames = read(`${root}/src/lib/i18n/tool-seo-localization.ts`);
const overrides = read(`${root}/src/lib/i18n/locale-quality-overrides.ts`);

const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
const quickflowKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const toolUiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];

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
const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
const stringLeaves = (value, path = []) => {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => stringLeaves(child, [...path, key]));
};
const sameShape = (enValue, localizedValue, path = []) => {
  const location = path.join('.') || '<root>';
  if (typeof enValue !== typeof localizedValue) {
    fail(`Shape mismatch at ${location}: English is ${typeof enValue}, localized is ${typeof localizedValue}`);
    return;
  }
  if (typeof enValue === 'string') return;
  if (Array.isArray(enValue)) {
    if (!Array.isArray(localizedValue) || enValue.length !== localizedValue.length) {
      fail(`Array shape mismatch at ${location}: English=${enValue.length}, localized=${Array.isArray(localizedValue) ? localizedValue.length : '<non-array>'}`);
      return;
    }
    enValue.forEach((item, index) => sameShape(item, localizedValue[index], [...path, String(index)]));
    return;
  }
  if (!enValue || typeof enValue !== 'object' || !localizedValue || typeof localizedValue !== 'object') return;
  const enKeys = Object.keys(enValue).sort();
  const localizedKeys = Object.keys(localizedValue).sort();
  if (enKeys.join('|') !== localizedKeys.join('|')) {
    const missing = enKeys.filter((key) => !localizedKeys.includes(key));
    const extra = localizedKeys.filter((key) => !enKeys.includes(key));
    if (missing.length) fail(`Missing translation keys at ${location}: ${missing.join(', ')}`);
    if (extra.length) fail(`Unexpected translation keys at ${location}: ${extra.join(', ')}`);
  }
  for (const key of enKeys) if (key in localizedValue) sameShape(enValue[key], localizedValue[key], [...path, key]);
};

const overrideEntry = (locale) => {
  const match = new RegExp(`\\b${locale}:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\),?`, 'u').exec(overrides);
  return match?.[1] ?? '';
};
const effectiveHomeValue = (locale, key, sourceValue) => {
  const override = overrideEntry(locale);
  if (!override) return sourceValue;
  if (key === 'trust:') return override.match(/trust:\s*\[([\s\S]*?)\n\s*\]/u)?.[1] ?? sourceValue;
  const direct = extractString(override, key);
  return direct || sourceValue;
};

for (const locale of locales) {
  const homeEntry = entryBody(home, locale, 'copy');
  if (!homeEntry) fail(`Home: missing locale entry ${locale}`);
  else for (const key of homeKeys) if (!homeEntry.includes(key)) fail(`Home ${locale}: missing ${key}`);

  const quickEntry = entryBody(quickflow, locale, 'q');
  if (!quickEntry) fail(`QuickFlow: missing locale entry ${locale}`);
  else for (const key of quickflowKeys) if (!quickEntry.includes(key)) fail(`QuickFlow ${locale}: missing ${key}`);

  const uiEntry = objectBody(toolUi, locale);
  if (!uiEntry) fail(`Tool UI: missing locale entry ${locale}`);
  else for (const key of toolUiKeys) if (!uiEntry.includes(key)) fail(`Tool UI ${locale}: missing ${key}`);
}

const englishHome = entryBody(home, 'en', 'copy');
const englishQuick = entryBody(quickflow, 'en', 'q');
const englishLeakKeys = ['badge:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:', 'browserMeta:'];

for (const locale of nonEnglish) {
  const entry = entryBody(home, locale, 'copy');
  for (const key of englishLeakKeys) {
    const enValue = extractString(englishHome, key);
    const localizedValue = effectiveHomeValue(locale, key, extractString(entry, key));
    if (enValue && localizedValue === enValue && !allowedSameAsEnglish.has(normalize(enValue))) fail(`Home ${locale}: English fallback in ${key}`);
  }

  const quick = entryBody(quickflow, locale, 'q');
  for (const key of quickflowKeys) {
    const enValue = extractString(englishQuick, key);
    const localizedValue = extractString(quick, key);
    if (enValue && localizedValue === enValue && !allowedSameAsEnglish.has(normalize(enValue))) fail(`QuickFlow ${locale}: English fallback in ${key}`);
  }

  const scriptPattern = expectedScript[locale];
  if (scriptPattern) {
    const localizedLeaves = [
      ...homeKeys.map((key) => effectiveHomeValue(locale, key, extractString(entry, key))),
      ...quickflowKeys.map((key) => extractString(quick, key)),
      ...toolUiKeys.map((key) => extractString(objectBody(toolUi, locale), key)),
    ].filter(Boolean).map(normalize).filter((value) => value.length >= 4);
    const weak = localizedLeaves.filter((value) => {
      const letters = [...value].filter((char) => /\p{L}/u.test(char));
      return letters.length >= 4 && !scriptPattern.test(value) && !/^(?:FLIXO|QuickFlow|OCR|PDF|English|العربية|Smart Intent|Ctrl K)/u.test(value);
    });
    if (weak.length) fail(`${locale}: localized UI contains values without the expected script: ${weak.slice(0, 5).join(' | ')}`);
  }
}

const htmlSource = extractString(englishHome, 'heroTitle:');
for (const locale of locales) {
  const entry = entryBody(home, locale, 'copy');
  const localizedHero = effectiveHomeValue(locale, 'heroTitle:', extractString(entry, 'heroTitle:'));
  const enTags = [...htmlSource.matchAll(/<[^>]+>/gu)].map((m) => m[0]);
  const localizedTags = [...localizedHero.matchAll(/<[^>]+>/gu)].map((m) => m[0]);
  if (enTags.join('|') !== localizedTags.join('|')) fail(`Home ${locale}: heroTitle HTML emphasis structure differs from English`);
}

const toolSeoObjects = [...seoNames.matchAll(/'[^']+':\s*Object\.freeze\(\{([^}]*)\}\)/gu)].map((match) => match[1]);
if (!toolSeoObjects.length) fail('No TOOL_SEO_NAMES entries found');
for (const [index, body] of toolSeoObjects.entries()) {
  for (const locale of locales) if (!new RegExp(`\\b${locale}:`, 'u').test(body)) fail(`SEO name entry ${index + 1}: missing ${locale}`);
}

const uiModules = await import(pathToFileURL(`${root}/src/data/tool-ui-i18n.ts`).href);
const homeModule = await import(pathToFileURL(`${root}/src/data/home-locales.ts`).href);
const quickflowModule = await import(pathToFileURL(`${root}/src/data/quickflow-locales.ts`).href);
const localeConfigModule = await import(pathToFileURL(`${root}/src/lib/i18n/config.ts`).href);

const runtimeContracts = [
  ['HOME_I18N', homeModule.HOME_I18N],
  ['QUICKFLOW_LOCALES', quickflowModule.QUICKFLOW_LOCALES],
  ['TOOL_UI_I18N', uiModules.TOOL_UI_I18N],
];
for (const [name, dictionary] of runtimeContracts) {
  const english = dictionary?.en;
  if (!english) {
    fail(`${name}: missing English baseline`);
    continue;
  }
  const englishLeaves = stringLeaves(english);
  for (const locale of nonEnglish) {
    const localized = dictionary?.[locale];
    if (!localized) {
      fail(`${name}: missing runtime locale ${locale}`);
      continue;
    }
    sameShape(english, localized, [name, locale]);
    for (const { path, value } of stringLeaves(localized)) {
      if (!value.trim()) fail(`${name}/${locale}: empty translation at ${path}`);
      const englishLeaf = englishLeaves.find((leaf) => leaf.path === path);
      if (englishLeaf && englishLeaf.value === value && !allowedSameAsEnglish.has(normalize(value))) {
        fail(`${name}/${locale}: exact English fallback at ${path}: ${JSON.stringify(value)}`);
      }
    }
  }
}

const configLocales = localeConfigModule.LOCALES ?? [];
if (configLocales.length !== locales.length || configLocales.some((locale, index) => locale !== locales[index])) fail(`Runtime LOCALES mismatch: ${configLocales.join(', ')}`);
const metadata = localeConfigModule.LOCALE_METADATA ?? {};
for (const locale of locales) {
  const actual = metadata[locale];
  if (!actual) fail(`Runtime locale metadata missing: ${locale}`);
  else if (actual.direction !== expectedDirection(locale)) fail(`Runtime direction mismatch for ${locale}: expected ${expectedDirection(locale)}, found ${actual.direction}`);
}

const localeFiles = readdirSync(`${root}/src/lib/i18n/locales`).filter((file) => file.endsWith('.ts')).map((file) => file.slice(0, -3));
const unexpectedLocaleFiles = localeFiles.filter((locale) => !locales.includes(locale));
if (unexpectedLocaleFiles.length) fail(`Unexpected locale files outside canonical registry: ${unexpectedLocaleFiles.join(', ')}`);

if (errors.length) {
  console.error(`Strict language quality gate failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Strict language quality gate passed: ${locales.length} canonical locales; runtime key-shape parity, non-empty translations, English-fallback rejection, locale metadata/direction, script checks, Home/QuickFlow/Tool UI coverage, HTML structure, and SEO locale coverage are clean.`);
