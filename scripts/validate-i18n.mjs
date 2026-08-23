import { existsSync, readFileSync } from 'node:fs';

const configSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const homeSource = readFileSync('src/data/home-locales.ts', 'utf8');
const quickflowSource = readFileSync('src/data/quickflow-i18n.ts', 'utf8');
const expected = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];

const localeList = configSource.match(/export const LOCALES = \[([\s\S]*?)\] as const/);
const listed = localeList?.[1]?.match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];
if (listed.length !== expected.length || listed.some((locale, index) => locale !== expected[index])) {
  console.error('LOCALES must contain exactly the canonical 20-locale order.');
  process.exit(1);
}

const missingMetadata = expected.filter((locale) => !new RegExp(`\\b${locale}:\\s*\\{`).test(configSource));
const missingFiles = expected.filter((locale) => !existsSync(`src/lib/i18n/locales/${locale}.ts`));
if (missingMetadata.length || missingFiles.length) {
  if (missingMetadata.length) console.error(`Missing locale metadata: ${missingMetadata.join(', ')}`);
  if (missingFiles.length) console.error(`Missing locale files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

const getHomeEntry = (locale) => new RegExp(`\\b${locale}:\\s*copy\\(\\{([\\s\\S]*?)\\}\\)`).exec(homeSource)?.[1] ?? '';
const requiredHomeKeys = ['nav:', 'badge:', 'heroTitle:', 'heroLead:', 'searchPlaceholder:', 'smartPalette:', 'trust:', 'quickDropTitle:', 'dropChoose:', 'toolboxTitle:', 'finalTitle:', 'quickTags:'];
const missingHomeLocales = expected.filter((locale) => {
  const entry = getHomeEntry(locale);
  return !entry || requiredHomeKeys.some((key) => !entry.includes(key));
});
if (missingHomeLocales.length) {
  console.error(`Home UI is incomplete for locale(s): ${missingHomeLocales.join(', ')}`);
  process.exit(1);
}

const englishHero = /heroLead:'([^']+)/.exec(getHomeEntry('en'))?.[1] ?? '';
const suspiciousFallbacks = expected.filter((locale) => {
  if (locale === 'en') return false;
  const entry = getHomeEntry(locale);
  return !entry || new RegExp(`heroLead:'${englishHero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(entry);
});
if (suspiciousFallbacks.length) {
  console.error(`Possible English fallback detected in Home locale(s): ${suspiciousFallbacks.join(', ')}`);
  process.exit(1);
}

for (const locale of ['en', 'ar']) {
  if (!new RegExp(`^\\s*${locale}:\\s*\\{`, 'm').test(quickflowSource)) {
    console.error(`Missing QuickFlow UI locale: ${locale}`);
    process.exit(1);
  }
}

const uiCoverage = ['src/routes/home-page.tsx', 'src/routes/localized-home.tsx', 'src/routes/ar-home-page.tsx', 'src/routes/en-quickflow.tsx', 'src/routes/ar-quickflow.tsx'];
const missingUiFiles = uiCoverage.filter((file) => !existsSync(file));
if (missingUiFiles.length > 0) {
  console.error(`Missing localized UI routes: ${missingUiFiles.join(', ')}`);
  process.exit(1);
}

console.log(`i18n validation passed: ${expected.length} locale files, ${expected.length} complete Home UI bundles, and localized Home routing are present.`);
