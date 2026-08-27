import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES, failValidation } from './validation-contracts.mjs';

const EXPECTED_LOCALES = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'];

if (CANONICAL_LOCALES.length !== EXPECTED_LOCALES.length || CANONICAL_LOCALES.some((locale, index) => locale !== EXPECTED_LOCALES[index])) {
  failValidation(`Canonical locale registry drifted: expected ${EXPECTED_LOCALES.join(', ')}`);
}

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const loader = readFileSync('src/lib/i18n/loader.ts', 'utf8');
const toolUi = readFileSync('src/data/tool-ui-i18n.ts', 'utf8');
const home = readFileSync('src/data/home-locales.ts', 'utf8');
const quickflow = readFileSync('src/data/quickflow-locales.ts', 'utf8');

for (const locale of EXPECTED_LOCALES) {
  if (!existsSync(`src/lib/i18n/locales/${locale}.ts`)) failValidation(`Missing locale dictionary: ${locale}`);
  if (!new RegExp(`\\b${locale}:\\s*async`).test(loader)) failValidation(`Loader missing locale: ${locale}`);
  if (!new RegExp(`\\b${locale}:\\s*\\{`).test(toolUi)) failValidation(`Tool UI missing locale: ${locale}`);
  if (!new RegExp(`\\b${locale}:\\s*copy`).test(home)) failValidation(`Home UI missing locale: ${locale}`);
  if (!new RegExp(`\\b${locale}:q\\(`).test(quickflow)) failValidation(`QuickFlow UI missing locale: ${locale}`);
}

const metadataEntries = config.match(/\\b(?:en|ar|es|fr|de|ru|zh|hi|id|ur|ja|pt|it|ko|nl|pl|tr|vi|th|sv):\\s*\\{/g) ?? [];
if (metadataEntries.length !== EXPECTED_LOCALES.length) {
  failValidation(`Locale metadata coverage is ${metadataEntries.length}/${EXPECTED_LOCALES.length}`);
}

if (!config.includes("ar: { languageTag: 'ar', direction: 'rtl' }")) failValidation('Arabic must remain RTL');
if (!config.includes("ur: { languageTag: 'ur', direction: 'rtl' }")) failValidation('Urdu must remain RTL');
if (!config.includes("en: { languageTag: 'en', direction: 'ltr' }")) failValidation('English must remain LTR');
if (!config.includes("zh: { languageTag: 'zh-CN', direction: 'ltr' }")) failValidation('Chinese language tag must remain zh-CN');

console.log(`Locale integrity gate passed: ${EXPECTED_LOCALES.length} fixed locales, dictionaries, loader, metadata, Home UI, QuickFlow UI, and Tool UI are aligned.`);
