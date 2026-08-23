import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (path) => readFile(resolve(root, path), 'utf8');

const [config, loader, translations] = await Promise.all([
  read('src/lib/i18n/config.ts'),
  read('src/lib/i18n/loader.ts'),
  read('src/lib/i18n/translations.ts'),
]);

const localeMatches = [...config.matchAll(/\b([a-z]{2})\s*,/g)].map((m) => m[1]);
const expected = [...new Set(localeMatches)].sort();
const dynamic = [...new Set([...loader.matchAll(/import\(['"]\.\/locales\/([a-z]{2})['"]\)/g)].map((m) => m[1]))].sort();
const failures = [];

if (/from ['"]\.\/locales\//.test(translations)) failures.push('translations.ts contains a static locale import');
if (expected.length !== dynamic.length || expected.some((locale, i) => locale !== dynamic[i])) {
  failures.push(`dynamic locale map mismatch: expected ${expected.length}, found ${dynamic.length}`);
}
if (!loader.includes('const cache = new Map<Locale, Promise<TranslationBundle>>')) failures.push('missing Promise cache');
if (!loader.includes('cache.set(locale, pending)')) failures.push('missing cache write');

if (failures.length) {
  console.error('FLIXO i18n lazy runtime: FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`FLIXO i18n lazy runtime: PASS (${expected.length} locales)`);
