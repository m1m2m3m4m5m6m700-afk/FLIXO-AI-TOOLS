import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const source = readFileSync('src/data/home-locales.ts', 'utf8');
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
if (!source.includes('dir:\'rtl\'')) {
  console.error('RTL locale direction is missing.');
  process.exit(1);
}
console.log(`Home localization coverage passed: ${expected.length} locales.`);
