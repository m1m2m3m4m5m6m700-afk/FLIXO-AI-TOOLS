import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES, failValidation } from './validation-utils.mjs';

const locales = CANONICAL_LOCALES;
const requiredFields = ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText'];
const completeTools = [
  'background-remover',
  'image-compressor',
  'image-converter',
  'image-cropper',
  'exif-cleaner',
  'background-blur',
];

for (const toolId of completeTools) {
  const root = `src/tools/${toolId}`;
  const manifestPath = `${root}/manifest.ts`;
  const seoDir = `${root}/seo`;
  if (!existsSync(manifestPath)) failValidation(`${toolId} is missing manifest.ts`);
  if (!existsSync(seoDir)) failValidation(`${toolId} is missing seo directory`);

  const manifest = readFileSync(manifestPath, 'utf8');
  for (const locale of locales) {
    const path = `${seoDir}/${locale}.ts`;
    if (!existsSync(path)) failValidation(`${toolId} is missing locale ${locale}`);
    const source = readFileSync(path, 'utf8');
    for (const field of requiredFields) {
      if (!new RegExp(`\\b${field}\\s*:`).test(source)) failValidation(`${toolId}/${locale}.ts is missing ${field}`);
    }
    if (!source.includes(`export const ${locale}`)) failValidation(`${toolId}/${locale}.ts must export ${locale}`);
    if (locale === 'ar' && (source.match(/[\u0600-\u06ff]/g) ?? []).length < 40) failValidation(`${toolId}/ar.ts is not sufficiently localized`);
  }

  const manifestLocaleCount = locales.filter((locale) => manifest.includes(`./seo/${locale}`)).length;
  if (manifestLocaleCount !== locales.length) failValidation(`${toolId} manifest imports ${manifestLocaleCount}/${locales.length} locales`);
}

console.log(`Full localization gate passed: ${completeTools.length} tools × ${locales.length} locales.`);
