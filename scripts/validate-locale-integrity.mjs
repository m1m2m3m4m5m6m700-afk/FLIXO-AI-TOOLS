import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES, failValidation } from './validation-contracts.mjs';

const EXPECTED_LOCALES = [...CANONICAL_LOCALES];
if (EXPECTED_LOCALES.length !== 20) failValidation(`Canonical locale registry must contain exactly 20 locales, found ${EXPECTED_LOCALES.length}`);

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

const metadataEntries = config.match(/(?:^|[,{\n]\s*)([a-z]{2}):\s*\{/g) ?? [];
if (metadataEntries.length !== EXPECTED_LOCALES.length) {
  failValidation(`Locale metadata coverage is ${metadataEntries.length}/${EXPECTED_LOCALES.length}`);
}

if (!config.includes("ar: { languageTag: 'ar', direction: 'rtl' }")) failValidation('Arabic must remain RTL');
if (!config.includes("en: { languageTag: 'en', direction: 'ltr' }")) failValidation('English must remain LTR');
if (!config.includes("ms: { languageTag: 'ms', direction: 'ltr' }")) failValidation('Malay locale metadata missing');
if (!config.includes("uk: { languageTag: 'uk', direction: 'ltr' }")) failValidation('Ukrainian locale metadata missing');
if (config.includes("zh: { languageTag: 'zh-CN', direction: 'ltr' }") || config.includes("ur: { languageTag: 'ur', direction: 'rtl' }")) {
  failValidation('Superseded zh/ur locales must not remain in canonical runtime metadata');
}

console.log(`Locale integrity gate passed: ${EXPECTED_LOCALES.length} canonical locales, dictionaries, loader, metadata, Home UI, QuickFlow UI, and Tool UI are aligned.`);
