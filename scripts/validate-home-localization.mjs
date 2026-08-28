import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const source = readFileSync('src/data/home-locales.ts', 'utf8');
const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
const translations = readFileSync('src/lib/i18n/translations.ts', 'utf8');
const overrides = readFileSync('src/lib/i18n/locale-quality-overrides.ts', 'utf8');

const expected = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
const rtlLocales = new Set(['ar', 'ur']);
const required = [
  'language','dir','badge','eyebrow','heroTitle','heroLead','describe','searchLabel','searchPlaceholder',
  'smartPalette','suggested','openDirectly','popular','trust','quickDrop','quickDropTitle','quickDropLead',
  'dropChoose','dropSupport','suggestedTool','openTool','toolbox','toolboxTitle','ready','empty',
  'builtForFocus','finalTitle','finalLead','trySmart','all','browserMeta','ariaHome','ariaPrimary',
  'ariaFindTool','ariaTrust','ariaCategories','quickTags',
];

if (expected.length !== 20) {
  console.error(`Certified Home locale set must contain 20 locales; found ${expected.length}.`);
  process.exit(1);
}

const localeMarkers = [...source.matchAll(/\n  ([a-z]{2}): copy\(\{/g)].map((m) => [m[1], m.index]);
const blockMap = new Map(localeMarkers);
const missingLocales = expected.filter((locale) => !blockMap.has(locale));
const unexpectedLocales = localeMarkers.map(([locale]) => locale).filter((locale) => !expected.includes(locale));
if (missingLocales.length || unexpectedLocales.length || blockMap.size !== expected.length) {
  console.error(`Home locale set mismatch. Missing: ${missingLocales.join(', ') || 'none'}; unexpected: ${unexpectedLocales.join(', ') || 'none'}.`);
  process.exit(1);
}

for (const locale of expected) {
  const start = blockMap.get(locale);
  const next = localeMarkers.find(([, index]) => index > start)?.[1] ?? source.length;
  const block = source.slice(start, next);

  for (const key of required) {
    if (!block.includes(`${key}:`)) {
      console.error(`${locale}: missing Home translation key: ${key}`);
      process.exit(1);
    }
  }

  const expectedDirection = rtlLocales.has(locale) ? 'rtl' : 'ltr';
  if (!block.includes(`dir:'${expectedDirection}'`)) {
    console.error(`${locale}: expected direction ${expectedDirection}.`);
    process.exit(1);
  }

  const expectedLanguage = locale === 'zh' ? 'zh-CN' : locale;
  if (!block.includes(`language:'${expectedLanguage}'`)) {
    console.error(`${locale}: language metadata is inconsistent.`);
    process.exit(1);
  }
}

const scriptChecks = {
  ar: /[\u0600-\u06ff]/,
  ur: /[\u0600-\u06ff]/,
  ru: /[\u0400-\u04ff]/,
  zh: /[\u4e00-\u9fff]/,
  ja: /[\u3040-\u30ff]/,
  ko: /[\uac00-\ud7af]/,
  th: /[\u0e00-\u0e7f]/,
  hi: /[\u0900-\u097f]/,
};
for (const [locale, pattern] of Object.entries(scriptChecks)) {
  const start = blockMap.get(locale);
  const next = localeMarkers.find(([, index]) => index > start)?.[1] ?? source.length;
  if (!pattern.test(source.slice(start, next))) {
    console.error(`${locale}: expected native-script content was not found.`);
    process.exit(1);
  }
}

for (const locale of ['ar', 'ur']) {
  if (!rtlLocales.has(locale)) {
    console.error(`${locale}: RTL locale classification drifted.`);
    process.exit(1);
  }
}

if (!source.includes("dir:'rtl'")) {
  console.error('RTL locale direction is missing.');
  process.exit(1);
}

const runtimeHomeImport = /(^|\n)\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*home-locales['"]/m;
if (runtimeHomeImport.test(homePage)) {
  console.error('HomePage must not runtime-import home-locales.ts; use the lazy home loader.');
  process.exit(1);
}
if (!source.includes('HOME_I18N')) {
  console.error('home-locales.ts must remain the canonical HOME_I18N source during locale extraction.');
  process.exit(1);
}
if (/(?:import|export)\s+(?:[^'";]+?from\s+)?['"].*\/locales\/[^'"]+['"]/.test(translations)) {
  console.error('translations.ts must not statically import locale modules.');
  process.exit(1);
}
if (!overrides.includes('HOME_COPY_OVERRIDES')) {
  console.error('Human-reviewed Home translation overrides are missing.');
  process.exit(1);
}

console.log(`Home localization coverage passed: ${expected.length}/${expected.length} locales.`);
console.log('Home required-field, direction, metadata, native-script, lazy-boundary, and reviewed-override checks passed.');
