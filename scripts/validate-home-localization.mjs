import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const source = readFileSync('src/data/home-locales.ts', 'utf8');
const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
const translations = readFileSync('src/lib/i18n/translations.ts', 'utf8');
const expected = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
const required = ['language','dir','badge','eyebrow','heroTitle','heroLead','describe','searchLabel','searchPlaceholder','smartPalette','suggested','openDirectly','popular','quickDrop','quickDropTitle','quickDropLead','dropChoose','dropSupport','suggestedTool','openTool','toolbox','toolboxTitle','ready','empty','builtForFocus','finalTitle','finalLead','trySmart','all','browserMeta','ariaHome','ariaPrimary','ariaFindTool','ariaTrust','ariaCategories','quickTags'];
const missingLocales = expected.filter((locale) => !new RegExp(`^  ${locale}: copy\\(\\{`, 'm').test(source));
if (missingLocales.length) {
  console.error(`Missing Home translations: ${missingLocales.join(', ')}`);
  process.exit(1);
}
for (const key of required) {
  if (!source.includes(`${key}:`)) {
    console.error(`Missing required Home translation key: ${key}`);
    process.exit(1);
  }
}
if (!source.includes("dir:'rtl'")) {
  console.error('RTL locale direction is missing.');
  process.exit(1);
}
const homeLocaleRuntimeImport = /import\s+(?!type\b)(?:[^'";]+?\s+from\s+)?['"](?:\.\.\/data\/home-locales|@\/data\/home-locales)['"]/;
if (homeLocaleRuntimeImport.test(homePage)) {
  console.error('HomePage must not statically import home-locales.ts; use the lazy home loader.');
  process.exit(1);
}
if (!homePage.includes('loadHomeCopy(')) {
  console.error('HomePage must use loadHomeCopy() for localized copy.');
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
console.log(`Home localization coverage passed: ${expected.length} locales.`);
console.log('Home lazy boundary contract passed.');
