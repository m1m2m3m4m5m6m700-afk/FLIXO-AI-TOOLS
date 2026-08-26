import { readFileSync } from 'node:fs';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const robotsSource = readFileSync('public/robots.txt', 'utf8');
const i18nSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const useCasesSource = readFileSync('src/lib/seo/use-cases.ts', 'utf8');

const siteOriginMatch = i18nSource.match(/export const SITE_ORIGIN = '([^']+)'/);
if (!siteOriginMatch) throw new Error('Canonical SITE_ORIGIN is missing from i18n config.');
const siteOrigin = siteOriginMatch[1];

if (!/^https:\/\//.test(siteOrigin)) throw new Error('Canonical SITE_ORIGIN must be HTTPS.');
if (!robotsSource.includes(`Sitemap: ${siteOrigin}/sitemap.xml`)) {
  throw new Error('robots.txt sitemap URL does not match the canonical SITE_ORIGIN.');
}

if (!sitemapSource.includes("../src/lib/i18n/config.ts")) {
  throw new Error('Sitemap generator is not connected to the canonical i18n config.');
}
if (!sitemapSource.includes('SITE_ORIGIN')) {
  throw new Error('Sitemap generator does not use the canonical SITE_ORIGIN.');
}
if (!sitemapSource.includes("import { USE_CASES } from '../src/lib/seo/use-cases.ts'")) {
  throw new Error('Sitemap generator is not connected to the canonical use-case manifest.');
}
if (!sitemapSource.includes('const useCasePaths = USE_CASES.map')) {
  throw new Error('Sitemap generator does not emit canonical use-case URLs.');
}
if (!sitemapSource.includes("import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts'")) {
  throw new Error('Sitemap generator is not connected to the canonical tool manifest.');
}
if (!sitemapSource.includes('const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady)')) {
  throw new Error('Sitemap generator does not derive tool URLs from TOOL_MANIFEST.');
}
if (!sitemapSource.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) {
  throw new Error('Sitemap generator is missing xhtml namespace for hreflang alternates.');
}
if (!sitemapSource.includes('xhtml:link rel="alternate" hreflang=')) {
  throw new Error('Sitemap generator does not emit hreflang alternates.');
}

const slugs = [...useCasesSource.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
if (slugs.length === 0) throw new Error('No use-case slugs found for sitemap indexing.');

const requiredRoutes = slugs.map((slug) => `${siteOrigin}/use-cases/${slug}`);
console.log(
  `Indexing validation passed: ${requiredRoutes.length} use-case URLs are wired into sitemap generation, TOOL_MANIFEST supplies tool URLs, hreflang alternates are enabled, and robots.txt points to the canonical HTTPS origin.`,
);
