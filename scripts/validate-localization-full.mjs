import { existsSync, readFileSync } from 'node:fs';

const locales = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'];
const requiredFields = ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText'];
const completeTools = [
  'background-remover',
  'image-compressor',
  'image-converter',
  'image-cropper',
  'exif-cleaner',
  'background-blur',
];

function fail(message) {
  console.error(`Localization gate failed: ${message}`);
  process.exit(1);
}

for (const toolId of completeTools) {
  const root = `src/tools/${toolId}`;
  const manifestPath = `${root}/manifest.ts`;
  const seoDir = `${root}/seo`;
  if (!existsSync(manifestPath)) fail(`${toolId} is missing manifest.ts`);
  if (!existsSync(seoDir)) fail(`${toolId} is missing seo directory`);

  const manifest = readFileSync(manifestPath, 'utf8');
  for (const locale of locales) {
    const path = `${seoDir}/${locale}.ts`;
    if (!existsSync(path)) fail(`${toolId} is missing locale ${locale}`);
    const source = readFileSync(path, 'utf8');
    for (const field of requiredFields) {
      if (!new RegExp(`\\b${field}\\s*:`).test(source)) fail(`${toolId}/${locale}.ts is missing ${field}`);
    }
    if (!source.includes(`export const ${locale}`)) fail(`${toolId}/${locale}.ts must export ${locale}`);
    if (locale === 'ar' && (source.match(/[\u0600-\u06ff]/g) ?? []).length < 40) fail(`${toolId}/ar.ts is not sufficiently localized`);
  }

  const manifestLocaleCount = locales.filter((locale) => manifest.includes(`./seo/${locale}`)).length;
  if (manifestLocaleCount !== locales.length) fail(`${toolId} manifest imports ${manifestLocaleCount}/${locales.length} locales`);
}

console.log(`Full localization gate passed: ${completeTools.length} tools × ${locales.length} locales.`);
