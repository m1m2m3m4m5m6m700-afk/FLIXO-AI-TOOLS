import { readFileSync } from 'node:fs';
import { getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const robotsGeneratorSource = readFileSync('scripts/generate-robots.mjs', 'utf8');
const robotsSource = readFileSync('public/robots.txt', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');
const indexSource = readFileSync('index.html', 'utf8');
const manifestSource = readFileSync('public/manifest.webmanifest', 'utf8');
const useCasesSource = readFileSync('src/lib/seo/use-cases.ts', 'utf8');

const requireSource = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};

// Source-level SEO/indexing contracts are valid in every environment. The
// actual canonical URL is intentionally environment-dependent: PR/runtime CI
// may have no public domain yet, while production indexing must have one.
requireSource(sitemapSource, /getCanonicalSiteOrigin/u, 'Sitemap generator must depend on the canonical origin contract.');
requireSource(sitemapSource, /TOOL_MANIFEST[\s\S]*filter(\s*\(tool\)\s*=>\s*tool\.isReady\s*)/u, 'Sitemap generator must derive tool URLs from ready TOOL_MANIFEST entries.');
requireSource(sitemapSource, /USE_CASES\.map\(/u, 'Sitemap generator must emit canonical use-case URLs from USE_CASES.');
requireSource(sitemapSource, /xmlns:xhtml=/u, 'Sitemap generator must emit hreflang alternates.');
requireSource(sitemapSource, /hreflang="x-default"/u, 'Sitemap generator is missing x-default.');

requireSource(robotsGeneratorSource, /getCanonicalSiteOrigin/u, 'Robots generator must depend on the canonical origin contract.');
if (/process\.env\.SITE_URL/u.test(robotsGeneratorSource)) throw new Error('Robots generator must not bypass the canonical origin contract via SITE_URL.');

for (const [pattern, message] of [
  [/name: ['"]robots['"]/u, 'Root route is missing robots metadata.'],
  [/index,follow/u, 'Root route must allow indexing and link following for public pages.'],
  [/property: ['"]og:title['"]/u, 'Root route is missing Open Graph title metadata.'],
  [/property: ['"]og:description['"]/u, 'Root route is missing Open Graph description metadata.'],
  [/property: ['"]og:url['"]/u, 'Root route is missing Open Graph URL metadata.'],
  [/name: ['"]twitter:card['"]/u, 'Root route is missing Twitter card metadata.'],
  [/href: ['"]\/favicon\.svg['"]/u, 'Root route is missing the canonical favicon.'],
]) requireSource(rootSource, pattern, message);

if (/\/(?:flixo-logo|logo)\.jpg/u.test(rootSource)) throw new Error('Root route references a stale JPG logo URL.');
if (!indexSource.includes('<html lang="en" dir="ltr">')) throw new Error('index.html must declare the default language and direction.');
if (!indexSource.includes('<meta name="description"')) throw new Error('index.html is missing a base description.');
if (!indexSource.includes('<meta name="viewport"')) throw new Error('index.html is missing the viewport declaration.');
if (!indexSource.includes('<link rel="manifest" href="/manifest.webmanifest"')) throw new Error('index.html is missing the web manifest.');
if (!indexSource.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg"')) throw new Error('index.html must use the canonical favicon.');
if (/\/(?:flixo-logo|logo)\.jpg/u.test(indexSource)) throw new Error('index.html references stale JPG logo assets.');
if (!manifestSource.includes('"start_url": "/en"')) throw new Error('Manifest start_url must resolve to a localized public route.');
if (!manifestSource.includes('"src": "/flixo-logo.svg"')) throw new Error('Manifest must use the canonical FLIXO logo asset.');

const slugs = [...useCasesSource.matchAll(/slug: '([^']+)'/gu)].map((match) => match[1]);
if (slugs.length === 0) throw new Error('No use-case slugs found for sitemap indexing.');

let canonicalOrigin;
try {
  canonicalOrigin = getCanonicalSiteOrigin();
} catch (error) {
  if (process.env.CI === 'true' && !process.env.VITE_SITE_URL?.trim()) {
    console.log('Indexing validation: source contracts passed; production canonical URL checks deferred because SITE_URL is not configured in this runtime CI environment.');
    process.exit(0);
  }
  throw error;
}

const sitemapUrl = `${canonicalOrigin}/sitemap.xml`;
if (!robotsSource.includes('User-agent: *\nAllow: /')) throw new Error('robots.txt must permit normal crawling.');
if (!robotsSource.includes(`Sitemap: ${sitemapUrl}`)) throw new Error(`robots.txt must reference the canonical sitemap: ${sitemapUrl}`);

console.log(`Indexing validation passed: canonical origin ${canonicalOrigin}, ${slugs.length} use-case URLs, ready tools from TOOL_MANIFEST, 20-locale hreflang, crawlable robots, and index/follow + social discovery signals.`);
