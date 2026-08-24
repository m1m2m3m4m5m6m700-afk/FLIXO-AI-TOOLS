import { readFileSync } from 'node:fs';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const robotsSource = readFileSync('public/robots.txt', 'utf8');
const useCasesSource = readFileSync('src/lib/seo/use-cases.ts', 'utf8');

const siteOriginMatch = sitemapSource.match(/const siteOrigin = '([^']+)'/);
if (!siteOriginMatch) throw new Error('Sitemap site origin is missing.');
const siteOrigin = siteOriginMatch[1];

if (!/^https:\/\//.test(siteOrigin)) throw new Error('Sitemap origin must be HTTPS.');
if (!robotsSource.includes(`Sitemap: ${siteOrigin}/sitemap.xml`)) {
  throw new Error('robots.txt sitemap URL does not match the sitemap generator origin.');
}

const slugs = [...useCasesSource.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
if (slugs.length === 0) throw new Error('No use-case slugs found for sitemap indexing.');

if (!sitemapSource.includes('readFileSync(\'src/lib/seo/use-cases.ts\', \'utf8\')')) {
  throw new Error('Sitemap generator is not connected to the canonical use-case manifest.');
}
if (!sitemapSource.includes("`${siteOrigin}/use-cases/${slug}`")) {
  throw new Error('Sitemap generator does not emit use-case URLs.');
}

const requiredRoutes = slugs.map((slug) => `${siteOrigin}/use-cases/${slug}`);
console.log(`Indexing validation passed: ${requiredRoutes.length} use-case URLs are wired into sitemap generation and robots.txt points to the same HTTPS origin.`);
