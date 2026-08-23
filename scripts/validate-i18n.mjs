import { existsSync, readFileSync } from 'node:fs';

const configSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const homeSource = readFileSync('src/data/home-locales.ts', 'utf8');
const quickflowSource = readFileSync('src/data/quickflow-locales.ts', 'utf8');
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

const getQuoted = (entry, key) => entry.match(new RegExp(`${key}'([^']*)'`))?.[1] ?? '';
const englishHero = getQuoted(getHomeEntry('en'), 'heroLead:');
const suspiciousHomeFallbacks = expected.filter((locale) => locale !== 'en' && getQuoted(getHomeEntry(locale), 'heroLead:') === englishHero);
if (suspiciousHomeFallbacks.length) {
  console.error(`Possible English fallback detected in Home locale(s): ${suspiciousHomeFallbacks.join(', ')}`);
  process.exit(1);
}

const requiredQuickFlowKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const getQuickFlowEntry = (locale) => new RegExp(`\\b${locale}:q\\(\\{([\\s\\S]*?)\\}\\)`).exec(quickflowSource)?.[1] ?? '';
const missingQuickFlowLocales = expected.filter((locale) => {
  const entry = getQuickFlowEntry(locale);
  return !entry || requiredQuickFlowKeys.some((key) => !entry.includes(key));
});
if (missingQuickFlowLocales.length) {
  console.error(`QuickFlow UI is incomplete for locale(s): ${missingQuickFlowLocales.join(', ')}`);
  process.exit(1);
}

const getQuickFlowValue = (entry, field) => entry.match(new RegExp(`${field}:'([^']*)'`))?.[1] ?? '';
const englishQuickFlow = getQuickFlowEntry('en');
const quickFlowFields = ['missing','back','runLabel','choose','processing','result','download','chooseError','failure','running','run','resultAlt','progress'];
const untranslatedQuickFlow = expected.filter((locale) => locale !== 'en' && quickFlowFields.some((field) => {
  const english = getQuickFlowValue(englishQuickFlow, field);
  const localized = getQuickFlowValue(getQuickFlowEntry(locale), field);
  return Boolean(english) && localized === english;
}));
if (untranslatedQuickFlow.length) {
  console.error(`Untranslated QuickFlow copy detected in locale(s): ${untranslatedQuickFlow.join(', ')}`);
  process.exit(1);
}

const uiCoverage = ['src/routes/home-page.tsx', 'src/routes/localized-home.tsx', 'src/routes/ar-home-page.tsx', 'src/routes/en-quickflow.tsx', 'src/routes/ar-quickflow.tsx', 'src/routes/localized-quickflow.tsx'];
const missingUiFiles = uiCoverage.filter((file) => !existsSync(file));
if (missingUiFiles.length > 0) {
  console.error(`Missing localized UI routes: ${missingUiFiles.join(', ')}`);
  process.exit(1);
}

console.log(`i18n validation passed: ${expected.length} locale files, complete Home and QuickFlow UI copy, localized routes, and no exact English QuickFlow fallbacks.`);
