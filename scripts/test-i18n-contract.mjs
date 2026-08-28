import assert from 'node:assert/strict';

// Unit/contract execution is allowed to run outside GitHub Actions. Supply the
// approved production origin explicitly before importing modules that construct
// canonical SEO metadata. This is a test harness contract, not a runtime fallback.
process.env.VITE_SITE_URL ??= 'https://flexoai.vercel.app';

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

console.log('i18n contract tests passed.');
