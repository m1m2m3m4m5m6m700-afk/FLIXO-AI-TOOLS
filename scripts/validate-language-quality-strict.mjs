import { existsSync, readdirSync } from 'node:fs';
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
  ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ru: /[\u0400-\u04ff]/u,
  zh: /[\u3400-\u9fff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u,
  hi: /[\u0900-\u097f]/u,
  th: /[\u0e00-\u0e7f]/u,
});

const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
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
    if (englishItemsAreObjects && english.length !== localized.length) {
      report(`${context}: structured array length mismatch (${english.length} vs ${localized.length})`);
    }
    const comparableLength = Math.min(english.length, localized.length);
    for (let index = 0; index < comparableLength; index += 1) {
      compareShapeAndValues(english[index], localized[index], `${context}.${index}`);
    }
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
    if (en && en.value === leaf.value && !allowedSameAsEnglish.has(normalize(leaf.value))) {
      report(`${context}: exact English fallback at ${leaf.path}: ${JSON.stringify(leaf.value)}`);
    }
    const enTags = [...(en?.value ?? '').matchAll(/<[^>]+>/gu)].map((match) => match[0]);
    const locTags = [...leaf.value.matchAll(/<[^>]+>/gu)].map((match) => match[0]);
    if (en && enTags.join('|') !== locTags.join('|')) report(`${context}: HTML tag structure mismatch at ${leaf.path}`);
    const enPlaceholders = [...(en?.value ?? '').matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((match) => match[0]);
    const locPlaceholders = [...leaf.value.matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((match) => match[0]);
    if (en && enPlaceholders.join('|') !== locPlaceholders.join('|')) report(`${context}: placeholder structure mismatch at ${leaf.path}`);
  }
};
const importModule = async (relativePath) => import(pathToFileURL(`${root}/${relativePath}`).href);
const objectForLocale = (module, locale) => module?.[locale] ?? module?.default?.[locale] ?? null;
const runtimePairs = [
  ['HOME_I18N', 'src/data/home-locales.ts', 'HOME_I18N'],
  ['QUICKFLOW_LOCALES', 'src/data/quickflow-locales.ts', 'QUICKFLOW_LOCALES'],
  ['TOOL_UI_I18N', 'src/data/tool-ui-i18n.ts', 'TOOL_UI_I18N'],
];

const configModule = await importModule('src/lib/i18n/config.ts');
const configuredLocales = [...(configModule.LOCALES ?? [])];
if (configuredLocales.join('|') !== locales.join('|')) report(`Runtime locale registry drift: ${configuredLocales.join(', ')}`);
for (const locale of locales) {
  const metadata = configModule.LOCALE_METADATA?.[locale];
  if (!metadata) report(`Missing runtime locale metadata: ${locale}`);
  else if (metadata.direction !== (locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr')) report(`Direction mismatch: ${locale}`);
}

for (const [name, relativePath, exportName] of runtimePairs) {
  const module = await importModule(relativePath);
  const dictionary = module?.[exportName];
  const english = objectForLocale(dictionary, 'en');
  if (!english) {
    report(`${name}: English baseline missing`);
    continue;
  }
  for (const locale of nonEnglish) {
    const localized = objectForLocale(dictionary, locale);
    if (!localized) {
      report(`${name}: missing runtime locale ${locale}`);
      continue;
    }
    compareShapeAndValues(english, localized, `${name}/${locale}`);
    compareLeaves(english, localized, `${name}/${locale}`);
    const script = expectedScript[locale];
    if (script) {
      for (const { path, value } of leaves(localized)) {
        if (isNonTranslatablePath(path)) continue;
        const text = normalize(value);
        const letters = [...text].filter((char) => /\p{L}/u.test(char));
        if (letters.length < 4 || script.test(text)) continue;
        if (/^(?:FLIXO|QuickFlow|OCR|PDF|English|العربية|Smart Intent|Ctrl K)/u.test(text)) continue;
        report(`${name}/${locale}: expected ${locale} script missing at ${path}: ${JSON.stringify(text)}`);
      }
    }
  }
}

const localeDir = `${root}/src/lib/i18n/locales`;
if (existsSync(localeDir)) {
  const files = readdirSync(localeDir).filter((file) => file.endsWith('.ts')).map((file) => file.slice(0, -3));
  for (const locale of locales) if (!files.includes(locale)) report(`Missing locale file: ${locale}.ts`);
  for (const extra of files.filter((locale) => !locales.includes(locale))) report(`Unexpected locale file outside canonical registry: ${extra}.ts`);
}

const toolsDir = `${root}/src/tools`;
for (const toolId of readdirSync(toolsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
  const seoDir = `${toolsDir}/${toolId}/seo`;
  if (!existsSync(seoDir)) continue;
  const seoFiles = new Set(readdirSync(seoDir).filter((file) => file.endsWith('.ts')).map((file) => file.slice(0, -3)));
  for (const locale of locales) {
    if (!seoFiles.has(locale)) {
      report(`${toolId}/seo: missing locale ${locale}`);
      continue;
    }
  }
  if (!seoFiles.has('en')) continue;
  const englishModule = await importModule(`src/tools/${toolId}/seo/en.ts`);
  const english = objectForLocale(englishModule, 'en') ?? englishModule.default ?? Object.values(englishModule).find((value) => value && typeof value === 'object');
  if (!english || typeof english !== 'object') {
    report(`${toolId}/seo/en.ts: unable to resolve English SEO contract`);
    continue;
  }
  for (const locale of nonEnglish) {
    if (!seoFiles.has(locale)) continue;
    try {
      const localizedModule = await importModule(`src/tools/${toolId}/seo/${locale}.ts`);
      const localized = objectForLocale(localizedModule, locale) ?? localizedModule.default ?? Object.values(localizedModule).find((value) => value && typeof value === 'object');
      if (!localized || typeof localized !== 'object') {
        report(`${toolId}/seo/${locale}.ts: unable to resolve locale contract`);
        continue;
      }
      compareShapeAndValues(english, localized, `${toolId}/seo/${locale}`);
      compareLeaves(english, localized, `${toolId}/seo/${locale}`);
    } catch (error) {
      report(`${toolId}/seo/${locale}.ts: module load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (errors.length) {
  console.error(`STRICT LANGUAGE QUALITY GATE FAILED — ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`STRICT LANGUAGE QUALITY GATE PASSED — ${locales.length} locales; runtime key parity, non-empty values, fallback rejection, script/direction checks, UI contracts, SEO locale completeness, and placeholder/HTML integrity are clean.`);
