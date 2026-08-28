import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const locale = process.env.FLIXO_LOCALE ?? process.argv[2];
if (!locale || !CANONICAL_LOCALES.includes(locale)) {
  console.error(`Locale contract requires one canonical locale: ${CANONICAL_LOCALES.join(', ')}`);
  process.exit(1);
}

const errors = [];
const fail = (message) => errors.push(`${locale}: ${message}`);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

const readQuotedValueAfter = (source, marker) => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return '';
  const afterMarker = source.slice(markerIndex + marker.length);
  const quoteIndex = afterMarker.search(/['"]/u);
  if (quoteIndex < 0) return '';
  const quote = afterMarker[quoteIndex];
  const valueStart = quoteIndex + 1;
  const valueEnd = afterMarker.indexOf(quote, valueStart);
  return valueEnd >= 0 ? afterMarker.slice(valueStart, valueEnd) : '';
};

const extract = (source, key) => readQuotedValueAfter(source, key);
const extractEntryValue = (body, key) => readQuotedValueAfter(body, key);

const extractEntry = (source, localeCode, marker) => {
  const localeStart = `${localeCode}:`;
  const startIndex = source.indexOf(localeStart);
  if (startIndex < 0) return '';
  const markerStart = source.indexOf(`${marker}({`, startIndex + localeStart.length);
  if (markerStart < 0) return '';
  const bodyStart = markerStart + marker.length + 2;
  const rest = source.slice(bodyStart);
  const nextLocale = rest.search(/\n\s*[a-z]{2}:\s*(?:copy|q)\(\{/u);
  if (nextLocale >= 0) return rest.slice(0, nextLocale);
  const end = rest.search(/\n\s*\};/u);
  return end >= 0 ? rest.slice(0, end) : rest;
};

const extractObjectBody = (source, localeCode) => {
  const localeStart = `${localeCode}:`;
  const startIndex = source.indexOf(localeStart);
  if (startIndex < 0) return '';
  const objectStart = source.indexOf('{', startIndex + localeStart.length);
  if (objectStart < 0) return '';
  const rest = source.slice(objectStart + 1);
  const nextLocale = rest.search(/\n\s*[a-z]{2}:\s*\{/u);
  if (nextLocale >= 0) return rest.slice(0, nextLocale);
  const end = rest.search(/\n\s*\},?/u);
  return end >= 0 ? rest.slice(0, end) : rest;
};

const readLocaleDirection = (config, localeCode) => {
  const start = config.indexOf(`${localeCode}:`);
  if (start < 0) return '';
  const end = config.indexOf('\n', start);
  const entry = config.slice(start, end >= 0 ? end : config.length);
  return readQuotedValueAfter(entry, 'direction:');
};

const en = read('src/lib/i18n/locales/en.ts');
const locPath = `src/lib/i18n/locales/${locale}.ts`;

if (!existsSync(`${root}/${locPath}`)) {
  fail(`missing locale dictionary ${locPath}`);
} else {
  const loc = read(locPath);
  if (!loc.includes(`locale: '${locale}'`)) fail('locale identifier mismatch');
  for (const key of ['homeTitle:', 'homeDescription:']) if (!readQuotedValueAfter(loc, key)) fail(`missing ${key}`);

  if (locale !== 'en') for (const key of ['homeTitle:', 'homeDescription:']) {
    const enValue = extract(en, key); const locValue = extract(loc, key);
    if (enValue && locValue === enValue) fail(`English fallback in ${key}`);
    if (!locValue.trim()) fail(`empty translation in ${key}`);
  }

  const config = read('src/lib/i18n/config.ts');
  const direction = readLocaleDirection(config, locale);
  const expectedDirection = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
  if (direction !== expectedDirection) fail(`direction mismatch: expected ${expectedDirection}, found ${direction || '<missing>'}`);

  const home = read('src/data/home-locales.ts');
  const quick = read('src/data/quickflow-locales.ts');
  const ui = read('src/data/tool-ui-i18n.ts');
  const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
  const quickKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
  const uiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];
  const homeEntry = extractEntry(home, locale, 'copy');
  const quickEntry = extractEntry(quick, locale, 'q');
  const uiEntry = extractObjectBody(ui, locale);
  for (const key of homeKeys) if (!homeEntry.includes(key)) fail(`Home missing ${key}`);
  for (const key of quickKeys) if (!quickEntry.includes(key)) fail(`QuickFlow missing ${key}`);
  for (const key of uiKeys) if (!uiEntry.includes(key)) fail(`Tool UI missing ${key}`);

  if (locale !== 'en') {
    const enHome = extractEntry(home, 'en', 'copy');
    const enQuick = extractEntry(quick, 'en', 'q');
    for (const key of ['badge:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:']) {
      const a = extractEntryValue(enHome, key); const b = extractEntryValue(homeEntry, key);
      if (a && b === a) fail(`Home English fallback in ${key}`);
    }
    for (const key of quickKeys.filter((k) => k !== 'resultAlt:')) {
      const a = extractEntryValue(enQuick, key); const b = extractEntryValue(quickEntry, key);
      if (a && b === a) fail(`QuickFlow English fallback in ${key}`);
    }
    const heroEn = extractEntryValue(enHome, 'heroTitle:'); const heroLoc = extractEntryValue(homeEntry, 'heroTitle:');
    const signature = (value) => ({ spanOpen: (value.match(/<span\b/giu) ?? []).length, spanClose: (value.match(/<\/span>/giu) ?? []).length });
    const enSignature = signature(heroEn); const locSignature = signature(heroLoc);
    if (enSignature.spanOpen !== locSignature.spanOpen || enSignature.spanClose !== locSignature.spanClose) fail(`heroTitle HTML emphasis structure differs from English: expected ${JSON.stringify(enSignature)}, found ${JSON.stringify(locSignature)}`);
  }

  const seo = read('src/lib/i18n/tool-seo-localization.ts');
  const seoObjects = [...seo.matchAll(/Object\.freeze\(\{([^}]*)\}\)/gu)].map((m) => m[1]);
  if (!seoObjects.length) fail('SEO localization registry is empty');
  for (const [index, body] of seoObjects.entries()) if (!body.includes(`${locale}:`)) fail(`SEO name entry ${index + 1} missing ${locale}`);

  const expectedScript = { ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u, ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u, ru: /[\u0400-\u04ff]/u, zh: /[\u3400-\u9fff]/u, ja: /[\u3040-\u30ff\u3400-\u9fff]/u, ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u, hi: /[\u0900-\u097f]/u, th: /[\u0e00-\u0e7f]/u }[locale];
  if (expectedScript) {
    const candidates = [extractEntryValue(homeEntry, 'heroLead:'), extractEntryValue(homeEntry, 'describe:'), extractEntryValue(homeEntry, 'searchPlaceholder:'), extractEntryValue(quickEntry, 'choose:'), extractEntryValue(uiEntry, 'about:')].filter(Boolean).join(' ');
    if ([...candidates].filter((char) => /\p{L}/u.test(char)).length >= 12 && !expectedScript.test(candidates)) fail('expected locale script is not represented in translated UI samples');
  }

  const suspicious = ['Privacy-first', 'Browser-first', 'Instant start', 'Smart routing', 'Open smart command palette', 'Start with the tools people actually need.'];
  if (locale !== 'en') for (const term of suspicious) if (homeEntry.includes(`'${term}'`) || homeEntry.includes(`"${term}"`)) fail(`suspicious English phrase leaked: ${term}`);
}

if (errors.length) {
  console.error(`LOCALIZATION TEST FAILED — ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`LOCALIZATION TEST PASSED — ${locale}`);