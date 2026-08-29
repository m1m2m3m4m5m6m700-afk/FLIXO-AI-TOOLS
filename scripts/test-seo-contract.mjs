import assert from 'node:assert/strict';
import {
  LOCALES,
  LOCALE_METADATA,
  SITE_ORIGIN,
  X_DEFAULT_LOCALE,
} from '../src/lib/i18n/config.ts';
import {
  SEO_DEFAULT_LOCALE,
  absoluteUrl,
  buildHreflang,
  buildSeoMetadata,
  localizedPath,
} from '../src/lib/seo/index.ts';

assert.equal(LOCALES.length, 20);
assert.equal(SEO_DEFAULT_LOCALE, 'ar');
assert.equal(X_DEFAULT_LOCALE, 'en');
assert.equal(new URL(SITE_ORIGIN).protocol, 'https:');

const expectedSiteOrigin = new URL(SITE_ORIGIN).origin;
const basePath = '/tools';

assert.equal(
  absoluteUrl('/ar/tools?utm_source=test#fragment'),
  `${expectedSiteOrigin}/ar/tools`,
);
assert.throws(() => absoluteUrl('//evil.example/tools'));
assert.throws(() => absoluteUrl('https://evil.example/tools'));
assert.throws(() => absoluteUrl('javascript:alert(1)'));

assert.equal(localizedPath('ar', '/en/tools'), '/ar/tools');
assert.equal(localizedPath('en', '/'), '/en/');

const alternates = buildHreflang(`${basePath}?x=1#hash`);
assert.equal(alternates.length, LOCALES.length + 1);
assert.equal(new Set(alternates.map(({ hreflang }) => hreflang)).size, LOCALES.length + 1);
assert.equal(
  alternates.find(({ hreflang }) => hreflang === 'x-default')?.href,
  `${expectedSiteOrigin}/en/tools`,
);

const alternatesByTag = new Map(alternates.map((alternate) => [alternate.hreflang, alternate.href]));
for (const locale of LOCALES) {
  const languageTag = LOCALE_METADATA[locale].languageTag;
  const expected = `${expectedSiteOrigin}${localizedPath(locale, basePath)}`;
  const href = alternatesByTag.get(languageTag);
  assert.equal(href, expected, `hreflang target drift for ${languageTag}`);
  const url = new URL(href);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.origin, expectedSiteOrigin);
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
}

assert.equal(alternatesByTag.get(LOCALE_METADATA.zh.languageTag), `${expectedSiteOrigin}/zh/tools`);
assert.equal(alternatesByTag.get('x-default'), `${expectedSiteOrigin}/en/tools`);

const metadataByLocale = LOCALES.map((locale) => buildSeoMetadata({
  locale,
  path: `${basePath}?utm_source=test#fragment`,
  title: `Test ${locale}`,
  description: `Description ${locale}`,
}));

for (const metadata of metadataByLocale) {
  const expectedCanonical = `${expectedSiteOrigin}${localizedPath(metadata.language === 'zh-CN' ? 'zh' : LOCALES.find((locale) => LOCALE_METADATA[locale].languageTag === metadata.language), basePath)}`;
  assert.equal(metadata.canonical, expectedCanonical);
  assert.equal(metadata.structuredData.url, metadata.canonical);
  assert.equal(metadata.structuredData.inLanguage, metadata.language);
  assert.equal(metadata.alternates.length, LOCALES.length + 1);
  assert.equal(metadata.alternates.find(({ hreflang }) => hreflang === metadata.language)?.href, metadata.canonical);
  assert.equal(metadata.alternates.find(({ hreflang }) => hreflang === 'x-default')?.href, `${expectedSiteOrigin}/en/tools`);
}

const arMetadata = buildSeoMetadata({
  locale: 'ar',
  path: '/tools?utm_source=test#fragment',
  title: 'Test',
  description: 'Description',
});

assert.equal(arMetadata.canonical, `${expectedSiteOrigin}/ar/tools`);
assert.equal(arMetadata.language, LOCALE_METADATA.ar.languageTag);
assert.equal(arMetadata.direction, 'rtl');

console.log('SEO contract tests passed: canonical URLs, exact 20-locale hreflang targets, x-default, locale language tags, and structured-data URL parity.');
