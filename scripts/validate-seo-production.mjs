import { readFileSync } from 'node:fs';
import { LOCALES, LOCALE_METADATA, X_DEFAULT_LOCALE, getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const outputDir = process.env.FLIXO_GENERATED_OUTPUT_DIR?.trim() || 'dist';
const sitemapPath = `${outputDir}/sitemap.xml`;
const robotsPath = `${outputDir}/robots.txt`;

const fail = (message) => {
  console.error(`SEO production certification failed: ${message}`);
  process.exit(1);
};

const readRequired = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    fail(`required generated artifact is missing: ${path}`);
  }
};

const xmlEscape = (value) =>
  value.replace(/[&<>"']/gu, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);

const canonicalOrigin = getCanonicalSiteOrigin();
const sitemap = readRequired(sitemapPath);
const robots = readRequired(robotsPath);

if (!canonicalOrigin.startsWith('https://')) fail(`canonical origin is not HTTPS: ${canonicalOrigin}`);
if (/\b(?:localhost|127\.0\.0\.1|vercel\.(?:app|sh))\b/iu.test(sitemap)) fail('sitemap contains a forbidden local/preview host');
if (/\b(?:localhost|127\.0\.0\.1|vercel\.(?:app|sh))\b/iu.test(robots)) fail('robots.txt contains a forbidden local/preview host');

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
if (readyTools.length === 0) fail('no ready tools are available');

const expectedPaths = new Set(LOCALES.map((locale) => `/${locale}`));
for (const tool of readyTools) {
  for (const locale of LOCALES) expectedPaths.add(getLocalizedToolPath(tool, locale));
}

const locMatches = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
if (locMatches.length !== expectedPaths.size) fail(`sitemap has ${locMatches.length} <loc> entries; expected ${expectedPaths.size}`);

const uniqueLocs = new Set(locMatches);
if (uniqueLocs.size !== locMatches.length) fail('sitemap contains duplicate <loc> entries');

const expectedUrls = new Set([...expectedPaths].map((path) => new URL(path.slice(1), `${canonicalOrigin}/`).toString()));
for (const expectedUrl of expectedUrls) {
  if (!uniqueLocs.has(expectedUrl)) fail(`sitemap is missing expected URL: ${expectedUrl}`);
}
for (const actualUrl of uniqueLocs) {
  if (!expectedUrls.has(actualUrl)) fail(`sitemap contains an unexpected URL: ${actualUrl}`);
}

if (!sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) fail('sitemap is missing the XHTML namespace');

const urlBlocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/gu)].map((match) => match[1]);
if (urlBlocks.length !== locMatches.length) fail('sitemap <url> block count does not match <loc> count');

const localeTags = new Map(LOCALES.map((locale) => [locale, LOCALE_METADATA[locale].languageTag]));
const pathFromUrl = (url) => new URL(url).pathname.replace(/\/+$/u, '') || '/';
const localizedPrefix = new RegExp(`^/(?:${LOCALES.join('|')})(?:/|$)`, 'u');
const absoluteLocalizedUrl = (locale, path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const combinedPath = `/${locale}${normalizedPath}`.replace(/\/{2,}/gu, '/');
  return new URL(combinedPath.replace(/\/$/u, ''), `${canonicalOrigin}/`).toString();
};

for (const block of urlBlocks) {
  const loc = block.match(/<loc>([^<]+)<\/loc>/u)?.[1];
  if (!loc) fail('sitemap contains a <url> without <loc>');
  const path = pathFromUrl(loc);
  if (!localizedPrefix.test(path)) fail(`non-localized URL was published: ${loc}`);

  const pathWithoutLocale = path.replace(new RegExp(`^/(?:${LOCALES.join('|')})(?=/|$)`, 'u'), '') || '/';
  const alternateMatches = [...block.matchAll(/<xhtml:link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*\/>/gu)];
  if (alternateMatches.length !== LOCALES.length + 1) {
    fail(`${loc} has ${alternateMatches.length} alternates; expected ${LOCALES.length + 1}`);
  }

  const seenTags = new Set();
  for (const [, hreflang, href] of alternateMatches) {
    if (seenTags.has(hreflang)) fail(`${loc} contains duplicate hreflang: ${hreflang}`);
    seenTags.add(hreflang);
    if (!href.startsWith(`${canonicalOrigin}/`)) fail(`${loc} has alternate outside canonical origin: ${href}`);

    if (hreflang === 'x-default') {
      const expected = absoluteLocalizedUrl(X_DEFAULT_LOCALE, pathWithoutLocale);
      if (href !== expected) fail(`${loc} has incorrect x-default target: ${href}`);
      continue;
    }

    const locale = LOCALES.find((candidate) => localeTags.get(candidate) === hreflang);
    if (!locale) fail(`${loc} contains unsupported hreflang: ${hreflang}`);
    const expected = absoluteLocalizedUrl(locale, pathWithoutLocale);
    if (href !== expected) fail(`${loc} has incorrect ${hreflang} alternate: ${href}`);
  }

  for (const tag of localeTags.values()) if (!seenTags.has(tag)) fail(`${loc} is missing hreflang: ${tag}`);
  if (!seenTags.has('x-default')) fail(`${loc} is missing x-default hreflang`);

  const expectedEscapedLoc = xmlEscape(loc);
  if (!block.includes(`<loc>${expectedEscapedLoc}</loc>`)) fail(`malformed loc serialization for ${loc}`);
}

const sitemapLine = robots.match(/^Sitemap:\s*(\S+)$/mu)?.[1];
const expectedSitemapUrl = `${canonicalOrigin}/sitemap.xml`;
if (sitemapLine !== expectedSitemapUrl) fail(`robots.txt sitemap target is ${sitemapLine ?? 'missing'}; expected ${expectedSitemapUrl}`);
if (!/^User-agent:\s*\*\s*\nAllow:\s*\/$/mu.test(robots)) fail('robots.txt does not explicitly allow normal crawling');

console.log(`SEO production certification passed: ${locMatches.length} localized URLs, ${readyTools.length} ready tools, ${LOCALES.length} locales, symmetric hreflang + x-default, canonical HTTPS origin, and robots/sitemap artifacts aligned.`);
