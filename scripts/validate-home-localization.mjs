import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const source = readFileSync('src/data/home-locales.ts', 'utf8');
const overrides = readFileSync('src/lib/i18n/locale-quality-overrides.ts', 'utf8');
const homeLoader = readFileSync('src/lib/i18n/home-loader.ts', 'utf8');
const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
const translations = readFileSync('src/lib/i18n/translations.ts', 'utf8');

const expected = config.match(/export\s+const\s+LOCALES\s*=\s*\[([\s\S]*?)\]\s+as\s+const/)?.[1]
  ?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
const canonical = new Set(expected);
const deprecated = new Set(['zh', 'ur']);

if (expected.length !== 20 || expected.length !== canonical.size) {
  console.error(`LOCALES must contain exactly 20 unique canonical locales; got ${expected.length}.`);
  process.exit(1);
}
if ([...deprecated].some((locale) => canonical.has(locale))) {
  console.error('Deprecated home locales must never be canonical: zh/ur.');
  process.exit(1);
}

const primary = [...source.matchAll(/^\x20{2}([a-z]{2}): copy\(\{/gm)].map((m) => m[1]);
const reviewed = [...overrides.matchAll(/^\x20{2}([a-z]{2}): Object\.freeze\(\{/gm)].map((m) => m[1]);
const duplicateLocales = [...new Set(primary.filter((locale) => reviewed.includes(locale)))];
if (duplicateLocales.length) {
  console.error(`Home locale may not be defined in both primary catalog and reviewed overrides: ${duplicateLocales.join(', ')}`);
  process.exit(1);
}

const unsupportedPrimary = primary.filter((locale) => !canonical.has(locale) && !deprecated.has(locale));
if (unsupportedPrimary.length) {
  console.error(`Unsupported primary Home locales: ${unsupportedPrimary.join(', ')}`);
  process.exit(1);
}
const missingCanonical = expected.filter((locale) => !primary.includes(locale) && !reviewed.includes(locale));
if (missingCanonical.length) {
  console.error(`Missing canonical Home locales: ${missingCanonical.join(', ')}`);
  process.exit(1);
}

const required = ['language','dir','nav','badge','eyebrow','heroTitle','heroLead','describe','searchLabel','searchPlaceholder','smartPalette','suggested','openDirectly','popular','trust','quickDrop','quickDropTitle','quickDropLead','dropChoose','dropSupport','suggestedTool','openTool','toolbox','toolboxTitle','ready','empty','builtForFocus','finalTitle','finalLead','trySmart','all','browserMeta','ariaHome','ariaPrimary','ariaFindTool','ariaTrust','ariaCategories','quickTags'];
const readLocaleBlock = (text, locale, matcher) => {
  const start = text.indexOf(`  ${locale}: ${matcher}`);
  if (start < 0) return '';
  const next = text.indexOf('\n  ', start + 4);
  return text.slice(start, next < 0 ? text.length : next);
};
for (const locale of expected) {
  const block = primary.includes(locale)
    ? readLocaleBlock(source, locale, 'copy({')
    : readLocaleBlock(overrides, locale, 'Object.freeze({');
  const missingKeys = required.filter((key) => !block.includes(`${key}:`));
  if (missingKeys.length) {
    console.error(`Locale ${locale} is structurally incomplete; missing keys: ${missingKeys.join(', ')}`);
    process.exit(1);
  }
}

if (!/isLocale\(locale\)/.test(homeLoader) || !/return cached/.test(homeLoader)) {
  console.error('Home loader must enforce canonical locale validation before serving cached Home copy.');
  process.exit(1);
}
if (!source.includes('HOME_I18N')) {
  console.error('home-locales.ts must remain the Home catalog source.');
  process.exit(1);
}
const runtimeHomeImport = /(^|\n)\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*home-locales['"]/m;
if (runtimeHomeImport.test(homePage)) {
  console.error('HomePage must not runtime-import home-locales.ts; use the lazy home loader.');
  process.exit(1);
}
if (/(?:import|export)\s+(?:[^'";]+?from\s+)?['"].*\/locales\/[^'"]+['"]/.test(translations)) {
  console.error('translations.ts must not statically import locale modules.');
  process.exit(1);
}
console.log(`Home localization coverage passed: ${expected.length} canonical locales; deprecated legacy entries remain noncanonical: ${[...deprecated].join(', ')}.`);
console.log('Home lazy boundary contract passed.');
