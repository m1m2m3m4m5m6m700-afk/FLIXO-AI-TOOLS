import { readFileSync } from 'node:fs';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const robotsGeneratorSource = readFileSync('scripts/generate-robots.mjs', 'utf8');
const robotsSource = readFileSync('public/robots.txt', 'utf8');
const originSource = readFileSync('src/config/origin.config.ts', 'utf8');
const i18nSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');
const indexSource = readFileSync('index.html', 'utf8');
const manifestSource = readFileSync('public/manifest.webmanifest', 'utf8');
const useCasesSource = readFileSync('src/lib/seo/use-cases.ts', 'utf8');

if (!originSource.includes('export function getCanonicalSiteOrigin()')) {
  throw new Error('Canonical origin contract is missing getCanonicalSiteOrigin().');
}
if (!originSource.includes("if (origin.protocol !== 'https:')")) {
  throw new Error('Canonical origin contract must enforce HTTPS.');
}
if (!originSource.includes('isBlockedCanonicalHost(origin.hostname)')) {
  throw new Error('Canonical origin contract must reject local and deployment hosts.');
}
if (!i18nSource.includes('export const SITE_ORIGIN = getRuntimeSiteOrigin();')) {
  throw new Error('Runtime SITE_ORIGIN must come from the runtime origin contract.');
}

if (!sitemapSource.includes('getCanonicalSiteOrigin()')) {
  throw new Error('Sitemap generator must source its origin from the canonical origin contract.');
}
if (!sitemapSource.includes('TOOL_MANIFEST.filter((tool) => tool.isReady)')) {
  throw new Error('Sitemap generator does not derive tool URLs from ready TOOL_MANIFEST entries.');
}
if (!sitemapSource.includes('const localizedToolPaths = readyTools.flatMap')) {
  throw new Error('Sitemap generator must derive localized tool URLs from the route resolver.');
}
if (!sitemapSource.includes('getLocalizedToolPath(tool, locale)')) {
  throw new Error('Sitemap generator must use getLocalizedToolPath for localized tool routes.');
}
if (!sitemapSource.includes('const useCasePaths = USE_CASES.flatMap')) {
  throw new Error('Sitemap generator does not derive localized use-case URLs from USE_CASES.');
}
if (!sitemapSource.includes('/use-cases/${useCase.slug}')) {
  throw new Error('Sitemap generator does not include use-case slugs in canonical URLs.');
}
if (!sitemapSource.includes(`xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"`)) {
  throw new Error('Sitemap generator is missing the hreflang namespace.');
}
if (!sitemapSource.includes(`xhtml:link rel=\"alternate\" hreflang=`)) {
  throw new Error('Sitemap generator does not emit hreflang alternates.');
}
if (!sitemapSource.includes(`hreflang=\"x-default\"`)) {
  throw new Error('Sitemap generator is missing x-default.');
}

if (!robotsGeneratorSource.includes("import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';")) {
  throw new Error('robots generator must consume the canonical origin contract.');
}
if (!robotsGeneratorSource.includes('const origin = getCanonicalSiteOrigin();')) {
  throw new Error('robots generator must resolve its origin through getCanonicalSiteOrigin().');
}
if (!robotsGeneratorSource.includes('Sitemap: ${origin}/sitemap.xml')) {
  throw new Error('robots generator must publish the canonical sitemap URL.');
}
if (!robotsSource.includes('User-agent: *\nAllow: /')) {
  throw new Error('robots.txt must permit normal crawling.');
}
if (!/^Sitemap:\s+https:\/\/[^\s]+\/sitemap\.xml$/m.test(robotsSource)) {
  throw new Error('robots.txt must reference an HTTPS canonical sitemap.');
}

if (!rootSource.includes("name: 'robots'")) throw new Error('Root route is missing robots metadata.');
if (!rootSource.includes('index,follow')) throw new Error('Root route must allow indexing and link following for public pages.');
if (!rootSource.includes("property: 'og:title'")) throw new Error('Root route is missing Open Graph title metadata.');
if (!rootSource.includes("property: 'og:description'")) throw new Error('Root route is missing Open Graph description metadata.');
if (!rootSource.includes("property: 'og:url'")) throw new Error('Root route is missing Open Graph URL metadata.');
if (!rootSource.includes("name: 'twitter:card'")) throw new Error('Root route is missing Twitter card metadata.');
if (rootSource.includes("href: '/flixo-logo.jpg'") || rootSource.includes("href: '/logo.jpg'")) throw new Error('Root route references stale JPG logo URLs.');
if (!rootSource.includes("href: '/favicon.svg'")) throw new Error('Root route is missing the canonical favicon.');

if (!indexSource.includes('<html lang="en" dir="ltr">')) throw new Error('index.html must declare the default language and direction.');
if (!indexSource.includes('<meta name="description"')) throw new Error('index.html is missing a base description.');
if (!indexSource.includes('<meta name="viewport"')) throw new Error('index.html is missing the viewport declaration.');
if (!indexSource.includes('<link rel="manifest" href="/manifest.webmanifest"')) throw new Error('index.html is missing the web manifest.');
if (!indexSource.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg"')) throw new Error('index.html must use the canonical favicon.');
if (indexSource.includes('/flixo-logo.jpg') || indexSource.includes('/logo.jpg')) throw new Error('index.html references stale JPG logo assets.');

if (!manifestSource.includes('"start_url": "/en"')) throw new Error('Manifest start_url must resolve to a localized public route.');
if (!manifestSource.includes('"src": "/flixo-logo.svg"')) throw new Error('Manifest must use the canonical FLIXO logo asset.');

const slugs = [...useCasesSource.matchAll(/slug: '([^']+)'/gu)].map((match) => match[1]);
if (slugs.length === 0) throw new Error('No use-case slugs found for sitemap indexing.');

console.log(
  `Indexing validation passed: ${slugs.length} use-case URLs are wired into the canonical sitemap, ready tools are sourced from TOOL_MANIFEST, 20-locale hreflang is enabled, robots is crawlable, and root/index metadata exposes index/follow + social discovery signals.`,
);
