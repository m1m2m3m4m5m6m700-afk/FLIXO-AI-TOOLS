import assert from 'node:assert/strict';
import {
  LOCALES,
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

assert.equal(
  absoluteUrl('/ar/tools?utm_source=test#fragment'),
  'https://flexoai.vercel.app/ar/tools',
);
assert.throws(() => absoluteUrl('//evil.example/tools'));
assert.throws(() => absoluteUrl('https://evil.example/tools'));
assert.throws(() => absoluteUrl('javascript:alert(1)'));

assert.equal(localizedPath('ar', '/en/tools'), '/ar/tools');
assert.equal(localizedPath('en', '/'), '/en/');

const alternates = buildHreflang('/tools?x=1#hash');
assert.equal(alternates.length, 21);
assert.equal(new Set(alternates.map(({ hreflang }) => hreflang)).size, 21);
assert.equal(
  alternates.find(({ hreflang }) => hreflang === 'x-default')?.href,
  'https://flexoai.vercel.app/en/tools',
);

for (const alternate of alternates) {
  const url = new URL(alternate.href);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.origin, new URL(SITE_ORIGIN).origin);
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
}

const metadata = buildSeoMetadata({
  locale: 'ar',
  path: '/tools?utm_source=test#fragment',
  title: 'Test',
  description: 'Description',
});

assert.equal(metadata.canonical, 'https://flexoai.vercel.app/ar/tools');
assert.equal(metadata.language, 'ar');
assert.equal(metadata.direction, 'rtl');
assert.equal(metadata.structuredData.url, metadata.canonical);

console.log('SEO contract tests passed.');
