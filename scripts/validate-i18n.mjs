import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES as expected } from './validation-contracts.mjs';

const configSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const homeSource = (locale) => readFileSync(`src/data/home-locales/${locale}.ts`, 'utf8');
const quickflowSource = readFileSync('src/data/quickflow-locales.ts', 'utf8');
const toolUiSource = readFileSync('src/data/tool-ui-i18n.ts', 'utf8');
const localizedToolPageSource = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');

const listed = configSource.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];
if (listed.length !== expected.length || listed.some((locale, index) => locale !== expected[index])) {
  console.error('LOCALES registry extraction drifted from the canonical validator contract.'); process.exit(1);
}

const missingMetadata = expected.filter((locale) => !new RegExp(`\\b${locale}:\\s*\\{`).test(configSource));
const missingFiles = expected.filter((locale) => !existsSync(`src/lib/i18n/locales/${locale}.ts`));
if (missingMetadata.length || missingFiles.length) {
  if (missingMetadata.length) console.error(`Missing locale metadata: ${missingMetadata.join(', ')}`);
  if (missingFiles.length) console.error(`Missing locale files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

const missingToolUiLocales = expected.filter((locale) => !new RegExp(`\\b${locale}:\\s*\\{`).test(toolUiSource));
if (missingToolUiLocales.length) { console.error(`Tool UI localization is incomplete for locale(s): ${missingToolUiLocales.join(', ')}`); process.exit(1); }
if (!localizedToolPageSource.includes('<ToolComponent locale={locale} />')) { console.error('Localized tool route does not pass the active locale into the tool component.'); process.exit(1); }

const getHomeEntry = (locale) => homeSource(locale);
const requiredHomeKeys = ['nav:', 'badge:', 'heroTitle:', 'heroLead:', 'searchPlaceholder:', 'smartPalette:', 'trust:', 'quickDropTitle:', 'dropChoose:', 'toolboxTitle:', 'finalTitle:', 'quickTags:'];
const missingHomeLocales = expected.filter((locale) => {
  const entry = getHomeEntry(locale);
  return !entry || requiredHomeKeys.some((key) => !entry.includes(key));
});
if (missingHomeLocales.length) { console.error(`Home UI is incomplete for locale(s): ${missingHomeLocales.join(', ')}`); process.exit(1); }

const getQuoted = (entry, key) => entry.match(new RegExp(`${key}'([^']*)'`))?.[1] ?? '';
const englishHero = getQuoted(getHomeEntry('en'), 'lead:') || getQuoted(getHomeEntry('en'), 'heroLead:');
const suspiciousHomeFallbacks = expected.filter((locale) => locale !== 'en' && getQuoted(getHomeEntry(locale), 'lead:') === englishHero);
if (suspiciousHomeFallbacks.length) { console.error(`English Home fallback detected in locale(s): ${suspiciousHomeFallbacks.join(', ')}`); process.exit(1); }

const missingQuickflowLocales = expected.filter((locale) => !new RegExp(`\\b${locale}:\\s*q\\(`).test(quickflowSource));
if (missingQuickflowLocales.length) { console.error(`QuickFlow localization is incomplete for locale(s): ${missingQuickflowLocales.join(', ')}`); process.exit(1); }

console.log(`i18n contract passed for ${expected.length} canonical locales.`);
