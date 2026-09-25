#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES, failValidation } from './validation-utils.mjs';

const args = process.argv.slice(2);
const complete = spawnSync(process.execPath, [
  '--import=./scripts/register-node-resolver.mjs',
  '--experimental-strip-types',
  'scripts/validate-effective-localization.mjs',
  ...args,
], { stdio: 'inherit', env: process.env });
if (complete.error) {
  console.error(`Localization complete validator failed to start: ${complete.error.message}`);
  process.exit(1);
}
if (complete.signal) {
  console.error(`Localization complete validator terminated by signal: ${complete.signal}`);
  process.exit(1);
}
if ((complete.status ?? 1) !== 0) process.exit(complete.status ?? 1);

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
    const localePath = `${seoDir}/${locale}.ts`;
    if (!existsSync(localePath)) failValidation(`${toolId} is missing locale ${locale}`);
    const source = readFileSync(localePath, 'utf8');
    for (const field of requiredFields) {
      if (!new RegExp(`\\b${field}\\s*:`).test(source)) failValidation(`${toolId}/${locale}.ts is missing ${field}`);
    }
    if (!source.includes(`export const ${locale}`)) failValidation(`${toolId}/${locale}.ts must export ${locale}`);
    if (locale === 'ar' && (source.match(/[\\u0600-\\u06ff]/g) ?? []).length < 40) failValidation(`${toolId}/ar.ts is not sufficiently localized`);
  }
  const manifestLocaleCount = locales.filter((locale) => manifest.includes(`./seo/${locale}`)).length;
  if (manifestLocaleCount !== locales.length) failValidation(`${toolId} manifest imports ${manifestLocaleCount}/${locales.length} locales`);
}
console.log(`Full localization gate passed: ${completeTools.length} tools × ${locales.length} locales.`);

const coreLocales = ['en', 'ar'];
const coreRequiredFields = ['locale:', 'languageTag:', 'direction:', 'siteName:', 'homeTitle:', 'homeDescription:'];
for (const locale of coreLocales) {
  const localePath = `src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(localePath)) throw new Error(`Missing core locale file: ${localePath}`);
  const source = readFileSync(localePath, 'utf8');
  for (const field of coreRequiredFields) {
    if (!source.includes(field)) throw new Error(`${localePath} is missing ${field}`);
  }
  if (!source.includes(`export const ${locale}`)) throw new Error(`${localePath} must export ${locale}`);
}
const ar = readFileSync('src/lib/i18n/locales/ar.ts', 'utf8');
if (!/[\\u0600-\\u06ff]/.test(ar)) throw new Error('Arabic core locale contains no Arabic script.');
console.log('Core localization gate passed: EN + AR.');
console.log('Canonical localization gate passed: COMPLETE + FULL + CORE.');
