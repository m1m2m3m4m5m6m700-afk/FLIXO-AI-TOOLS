import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES, failValidation } from './validation-utils.mjs';

const root = process.cwd();
const read = (path) => readFileSync(path, 'utf8');
const errors = [];
const fail = (message) => errors.push(message);
const locales = CANONICAL_LOCALES;

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
const seoNames = read(`${root}/src/lib/i18n/tool-seo-localization.ts`);

const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
const quickflowKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const toolUiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];

const entryBody = (source, locale, marker) => new RegExp(`\\b${locale}:\\s*${marker}\\(\\{([\\s\\S]*?)\\}\\)`, 'u').exec(source)?.[1] ?? '';
const objectBody = (source, locale) => new RegExp(`\\b${locale}:\\s*\\{([\\s\\S]*?)\\}`, 'u').exec(source)?.[1] ?? '';

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
const extractString = (entry, key) => entry.match(new RegExp(`${key}['"]([^'"\\n]*)['"]`, 'u'))?.[1] ?? '';
const englishLeakKeys = ['badge:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:', 'browserMeta:'];
for (const locale of locales.filter((value) => value !== 'en')) {
  const entry = entryBody(home, locale, 'copy');
  for (const key of englishLeakKeys) {
    const enValue = extractString(englishHome, key);
    const localizedValue = extractString(entry, key);
    if (enValue && localizedValue === enValue) fail(`Home ${locale}: English fallback in ${key}`);
  }

  const quick = entryBody(quickflow, locale, 'q');
  for (const key of quickflowKeys) {
    if (!key.endsWith(':')) continue;
    const enValue = extractString(englishQuick, key);
    const localizedValue = extractString(quick, key);
    if (enValue && localizedValue === enValue && !['resultAlt:'].includes(key)) fail(`QuickFlow ${locale}: English fallback in ${key}`);
  }
}

const htmlSource = extractString(englishHome, 'heroTitle:');
for (const locale of locales) {
  const entry = entryBody(home, locale, 'copy');
  const localizedHero = extractString(entry, 'heroTitle:');
  if ((htmlSource.includes('<span>') && !localizedHero.includes('<span>')) || (htmlSource.includes('</span>') && !localizedHero.includes('</span>'))) {
    fail(`Home ${locale}: heroTitle HTML emphasis structure differs from English`);
  }
}

for (const locale of locales) {
  const metadata = new RegExp(`${locale}:\\s*\\{[^}]*direction:\s*'([^']+)'`, 'u').exec(config)?.[1];
  const shouldBeRtl = locale === 'ar' || locale === 'ur';
  if ((metadata === 'rtl') !== shouldBeRtl) fail(`Direction mismatch for ${locale}: expected ${shouldBeRtl ? 'rtl' : 'ltr'}, found ${metadata ?? '<missing>'}`);
}

const toolSeoObjects = [...seoNames.matchAll(/'[^']+':\s*Object\.freeze\(\{([^}]*)\}\)/gu)].map((match) => match[1]);
if (!toolSeoObjects.length) fail('No TOOL_SEO_NAMES entries found');
for (const [index, body] of toolSeoObjects.entries()) {
  for (const locale of locales) {
    if (!new RegExp(`\\b${locale}:`, 'u').test(body)) fail(`SEO name entry ${index + 1}: missing ${locale}`);
  }
}

const suspiciousTerms = [
  'Privacy-first',
  'Browser-first',
  'Instant start',
  'Smart routing',
  'Open smart command palette',
  'Start with the tools people actually need.',
];
for (const locale of locales.filter((value) => value !== 'en')) {
  const entry = entryBody(home, locale, 'copy');
  for (const term of suspiciousTerms) {
    if (entry.includes(`'${term}'`) || entry.includes(`"${term}"`)) fail(`Home ${locale}: suspicious English phrase leaked: ${term}`);
  }
}

if (errors.length) {
  console.error(`Language quality gate failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Language quality gate passed: ${locales.length} locales; Home, QuickFlow, Tool UI, locale dictionaries, RTL/LTR, SEO-name completeness, and English-leak checks are clean.`);
