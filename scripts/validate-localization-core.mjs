import { existsSync, readFileSync } from 'node:fs';

const locales = ['en', 'ar'];
const requiredFields = ['locale:', 'languageTag:', 'direction:', 'siteName:', 'homeTitle:', 'homeDescription:'];

for (const locale of locales) {
  const path = `src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(path)) throw new Error(`Missing core locale file: ${path}`);
  const source = readFileSync(path, 'utf8');
  for (const field of requiredFields) {
    if (!source.includes(field)) throw new Error(`${path} is missing ${field}`);
  }
  if (!source.includes(`export const ${locale}`)) throw new Error(`${path} must export ${locale}`);
}

const ar = readFileSync('src/lib/i18n/locales/ar.ts', 'utf8');
if (!/[\u0600-\u06ff]/.test(ar)) throw new Error('Arabic core locale contains no Arabic script.');

console.log('Core localization gate passed: EN + AR.');
