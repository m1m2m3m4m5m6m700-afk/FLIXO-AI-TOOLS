import { existsSync, readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const homeLocaleSource = (locale) => readFileSync(`src/data/home-locales/${locale}.ts`, 'utf8');
const overrides = readFileSync('src/lib/i18n/locale-quality-overrides.ts', 'utf8');
const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
const translations = readFileSync('src/lib/i18n/translations.ts', 'utf8');
const expected = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
const required = ['language','dir','badge','eyebrow','heroTitle','heroLead','describe','searchLabel','searchPlaceholder','smartPalette','suggested','openDirectly','popular','quickDrop','quickDropTitle','quickDropLead','dropChoose','dropSupport','suggestedTool','openTool','toolbox','toolboxTitle','ready','empty','builtForFocus','finalTitle','finalLead','trySmart','all','browserMeta','ariaHome','ariaPrimary','ariaFindTool','ariaTrust','ariaCategories','quickTags'];

const missingLocales = expected.filter((locale) => {
  const inPrimary = existsSync(`src/data/home-locales/${locale}.ts`);
  const inOverrides = new RegExp(`^  ${locale}: Object\\.freeze\\(\\{`, 'm').test(overrides);
  return !inPrimary && !inOverrides;
});
if (missingLocales.length) {
  console.error(`Missing Home translations: ${missingLocales.join(', ')}`);
  process.exit(1);
}

for (const locale of expected) {
  const localeSource = homeLocaleSource(locale);
  for (const key of required) {
    if (!localeSource.includes(`${key}:`) && !overrides.includes(`${key}:`)) {
      console.error(`Missing required Home translation key for ${locale}: ${key}`);
      process.exit(1);
    }
  }
}
if (!homeLocaleSource('ar').includes("dir:'rtl'") && !homeLocaleSource('ar').includes("dir: 'rtl'")) {
  console.error('RTL locale direction is missing.');
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
console.log(`Home localization coverage passed: ${expected.length} canonical locales via primary catalog and reviewed overrides.`);
console.log('Home lazy boundary contract passed.');
