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

const CANONICAL_LOCALES = ['ar','en','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
assert.equal(DEFAULT_LOCALE, 'ar');
assert.equal(LOCALES.length, CANONICAL_LOCALES.length);
assert.deepEqual([...LOCALES], CANONICAL_LOCALES);
assert.equal(isLocale('ar'), true);
assert.equal(isLocale('zh'), true);
assert.equal(isLocale('ur'), true);
assert.equal(isLocale('ms'), false);
assert.equal(isLocale('uk'), false);
assert.equal(isLocale('xx'), false);

assert.equal(normalizeLocale('AR'), 'ar');
assert.equal(normalizeLocale('ar-EG'), 'ar');
assert.equal(normalizeLocale('en-US'), 'en');
assert.equal(normalizeLocale('ZH-CN'), 'zh');
assert.equal(normalizeLocale('UR-PK'), 'ur');
assert.equal(normalizeLocale('MS-MY'), DEFAULT_LOCALE);
assert.equal(normalizeLocale('uk-UA'), DEFAULT_LOCALE);
assert.equal(normalizeLocale('unknown'), DEFAULT_LOCALE);
assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE);
assert.equal(normalizeLocale(null), DEFAULT_LOCALE);

assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
assert.equal(LOCALE_METADATA.ur.direction, 'rtl');
assert.equal(LOCALE_METADATA.zh.languageTag, 'zh-CN');
assert.equal(LOCALE_METADATA.en.direction, 'ltr');

for (const locale of LOCALES) {
  assert.ok(LOCALE_METADATA[locale]);
  assert.equal(normalizeLocale(locale), locale);
}

console.log('i18n contract tests passed with deterministic test/runtime origins and authoritative 20-locale source of truth.');
