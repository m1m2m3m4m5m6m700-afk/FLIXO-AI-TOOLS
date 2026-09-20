import assert from 'node:assert/strict';

// Contract tests use an explicit test/runtime origin; production canonical config remains separate.
process.env.VITE_TEST_ORIGIN ??= 'https://canonical.test';
process.env.VITE_RUNTIME_ORIGIN ??= process.env.VITE_TEST_ORIGIN;

const {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_METADATA,
  isLocale,
  normalizeLocale,
} = await import('../src/lib/i18n/config.ts');

assert.equal(DEFAULT_LOCALE, 'ar');
assert.equal(LOCALES.length, 20);
assert.deepEqual([...LOCALES], ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi']);
assert.equal(isLocale('ar'), true);
assert.equal(isLocale('ms'), true);
assert.equal(isLocale('uk'), true);
assert.equal(isLocale('xx'), false);
assert.equal(isLocale('zh'), false);
assert.equal(isLocale('ur'), false);

assert.equal(normalizeLocale('AR'), 'ar');
assert.equal(normalizeLocale('ar-EG'), 'ar');
assert.equal(normalizeLocale('en-US'), 'en');
assert.equal(normalizeLocale('MS-MY'), 'ms');
assert.equal(normalizeLocale('uk-UA'), 'uk');
assert.equal(normalizeLocale('ZH-CN'), DEFAULT_LOCALE);
assert.equal(normalizeLocale('UR-PK'), DEFAULT_LOCALE);
assert.equal(normalizeLocale('unknown'), DEFAULT_LOCALE);
assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE);
assert.equal(normalizeLocale(null), DEFAULT_LOCALE);

assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
assert.equal(LOCALE_METADATA.ms.languageTag, 'ms');
assert.equal(LOCALE_METADATA.uk.languageTag, 'uk');
assert.equal(LOCALE_METADATA.en.direction, 'ltr');

for (const locale of LOCALES) {
  assert.ok(LOCALE_METADATA[locale]);
  assert.equal(normalizeLocale(locale), locale);
}

await import('./test-seo-contract.mjs');

console.log('i18n contract tests passed with deterministic test/runtime origins and authoritative 20-locale source of truth.');
