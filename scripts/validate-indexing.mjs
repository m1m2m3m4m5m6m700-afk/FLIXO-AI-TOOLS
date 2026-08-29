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
const useCaseRouteSource = readFileSync('src/routes/use-case.tsx', 'utf8');
const localizedToolRouteSource = readFileSync('src/routes/localized-tool.tsx', 'utf8');
const toolSeoSource = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');

const expectedLocales = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
const readyToolIds = [...readFileSync('src/config/tool-manifest.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
if (readyToolIds.length === 0) throw new Error('No tool ids discovered in TOOL_MANIFEST.');

if (!originSource.includes('export function getCanonicalSiteOrigin()')) throw new Error('Canonical origin contract is missing getCanonicalSiteOrigin().');
if (!originSource.includes("if (origin.protocol !== 'https:')")) throw new Error('Canonical origin contract must enforce HTTPS.');
if (!originSource.includes('isBlockedCanonicalHost(origin.hostname)')) throw new Error('Canonical origin contract must reject local and deployment hosts.');
if (!i18nSource.includes('export const SITE_ORIGIN = getRuntimeSiteOrigin();')) throw new Error('Runtime SITE_ORIGIN must come from the runtime origin contract.');

if (!sitemapSource.includes('getCanonicalSiteOrigin()')) throw new Error('Sitemap generator must source its origin from the canonical origin contract.');
if (!sitemapSource.includes('TOOL_MANIFEST.filter((tool) => tool.isReady)')) throw new Error('Sitemap generator does not derive tool URLs from ready TOOL_MANIFEST entries.');
if (!sitemapSource.includes('getLocalizedToolPath(tool, locale)')) throw new Error('Sitemap generator must use getLocalizedToolPath for localized tool routes.');
if (!sitemapSource.includes("const useCasePaths = USE_CASES.map((useCase) => `/use-cases/${useCase.slug}`)")) throw new Error('Sitemap generator must publish only the registered canonical use-case route.');
if (sitemapSource.includes('USE_CASES.flatMap((useCase) => LOCALES.map')) throw new Error('Sitemap must not publish localized use-case URLs before a localized use-case route exists.');
if (!sitemapSource.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) throw new Error('Sitemap generator is missing the hreflang namespace.');
if (!sitemapSource.includes('xhtml:link rel="alternate" hreflang=')) throw new Error('Sitemap generator does not emit hreflang alternates.');
if (!sitemapSource.includes('hreflang="x-default"')) throw new Error('Sitemap generator is missing x-default.');
if (!sitemapSource.includes('const isLocalizedPage = localePrefixPattern.test(path);')) throw new Error('Sitemap alternate emission must be limited to localized routes.');
if (sitemapSource.includes('vercel.app') || sitemapSource.includes('vercel.sh') || sitemapSource.includes('localhost')) throw new Error('Sitemap generator contains a forbidden deployment/local origin literal.');

if (!robotsGeneratorSource.includes("import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';")) throw new Error('robots generator must consume the canonical origin contract.');
if (!robotsGeneratorSource.includes('const origin = getCanonicalSiteOrigin();')) throw new Error('robots generator must resolve its origin through getCanonicalSiteOrigin().');
if (!robotsGeneratorSource.includes('Sitemap: ${origin}/sitemap.xml')) throw new Error('robots generator must publish the canonical sitemap URL.');
if (!robotsSource.includes('User-agent: *\nAllow: /')) throw new Error('robots.txt must permit normal crawling.');
if (!/^Sitemap:\s+https:\/\/[^\s]+\/sitemap\.xml$/m.test(robotsSource)) throw new Error('robots.txt must reference an HTTPS canonical sitemap.');

if (!rootSource.includes("name: 'robots'")) throw new Error('Root route is missing robots metadata.');
if (!rootSource.includes('index,follow')) throw new Error('Root route must allow indexing and link following for public pages.');
if (!rootSource.includes("property: 'og:title'")) throw new Error('Root route is missing Open Graph title metadata.');
if (!rootSource.includes("property: 'og:description'")) throw new Error('Root route is missing Open Graph description metadata.');
if (!rootSource.includes("property: 'og:url'")) throw new Error('Root route is missing Open Graph URL metadata.');
if (!rootSource.includes("name: 'twitter:card'")) throw new Error('Root route is missing Twitter card metadata.');
if (rootSource.includes("href: '/flixo-logo.jpg'") || rootSource.includes("href: '/logo.jpg'")) throw new Error('Root route references stale JPG logo URLs.');
if (!rootSource.includes("href: '/favicon.svg'")) throw new Error('Root route is missing the canonical favicon.');

if (!localizedToolRouteSource.includes("path: '/$locale/$tool'")) throw new Error('Localized tool route is missing.');
if (!localizedToolRouteSource.includes("rel: 'canonical'")) throw new Error('Localized tool canonical generation is missing.');
if (!localizedToolRouteSource.includes("hrefLang: 'x-default'")) throw new Error('Localized tool x-default hreflang is missing.');
const alternateCount = (toolSeoSource.match(/locale: alternateLocale/g) ?? []).length;
if (alternateCount !== 1) throw new Error('Tool SEO must derive alternates from the canonical LOCALES registry exactly once.');
if (!toolSeoSource.includes('LOCALES.map((alternateLocale)')) throw new Error('Tool SEO alternates must be generated from LOCALES.');
if (!toolSeoSource.includes('getLocalizedToolUrl(alternateLocale, tool.id)')) throw new Error('Tool SEO alternates must use the canonical localized URL resolver.');

if (!useCaseRouteSource.includes("path: '/use-cases/$slug'")) throw new Error('Use-case sitemap route is not registered.');
if (useCaseRouteSource.includes('hrefLang')) throw new Error('Use-case route must not claim hreflang symmetry until localized use-case routes exist.');
if (!useCaseRouteSource.includes("rel: 'canonical'")) throw new Error('Use-case route must emit a canonical URL.');

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
for (const slug of slugs) {
  if (!sitemapSource.includes(`/use-cases/${slug}`)) throw new Error(`Use-case slug is missing from the canonical sitemap generator: ${slug}`);
}

console.log(
  `Indexing validation passed: ${expectedLocales.length} locales, ${readyToolIds.length} tool ids, localized tool canonical/hreflang symmetry, canonical-only use-case routes, HTTPS canonical origin, and robots/sitemap contracts are aligned.`,
);
