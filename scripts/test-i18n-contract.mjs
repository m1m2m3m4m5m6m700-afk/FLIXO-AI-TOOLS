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

assert.equal(DEFAULT_LOCALE, 'en');
assert.equal(LOCALES.length, 20);
assert.equal(isLocale('ar'), true);
assert.equal(isLocale('xx'), false);

assert.equal(normalizeLocale('AR'), 'ar');
assert.equal(normalizeLocale('ar-EG'), 'ar');
assert.equal(normalizeLocale('en-US'), 'en');
assert.equal(normalizeLocale('UR-PK'), 'ur');
assert.equal(normalizeLocale('unknown'), DEFAULT_LOCALE);
assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE);
assert.equal(normalizeLocale(null), DEFAULT_LOCALE);

assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
assert.equal(LOCALE_METADATA.ur.direction, 'rtl');
assert.equal(LOCALE_METADATA.en.direction, 'ltr');
assert.equal(LOCALE_METADATA.zh.languageTag, 'zh-CN');

for (const locale of LOCALES) {
  assert.ok(LOCALE_METADATA[locale]);
  assert.equal(normalizeLocale(locale), locale);
}

await import('./test-seo-contract.mjs');

console.log('i18n contract tests passed with deterministic test/runtime origins.');
