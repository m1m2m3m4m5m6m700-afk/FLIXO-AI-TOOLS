import { readdirSync, readFileSync } from 'node:fs';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const robotsGeneratorSource = readFileSync('scripts/generate-robots.mjs', 'utf8');
const robotsSource = readFileSync('public/robots.txt', 'utf8');
const originSource = readFileSync('src/config/origin.config.ts', 'utf8');
const i18nSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');
const indexSource = readFileSync('index.html', 'utf8');
const manifestSource = readFileSync('public/manifest.webmanifest', 'utf8');
const useCaseRouteSource = readFileSync('src/routes/use-case.tsx', 'utf8');
const localizedToolRouteSource = readFileSync('src/routes/localized-tool.tsx', 'utf8');
const toolSeoSource = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');
const routeResolverSource = readFileSync('src/lib/routing/route-resolver.ts', 'utf8');

const toolDefinitionDir = 'src/config/tool-definitions';
const toolDefinitionSources = readdirSync(toolDefinitionDir).filter((name) => name.endsWith('.ts') && name !== 'types.ts').map((name) => readFileSync(`${toolDefinitionDir}/${name}`, 'utf8'));
const toolIds = toolDefinitionSources.flatMap((source) => [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]));
if (toolIds.length === 0) throw new Error('No tool ids discovered in canonical tool definition modules.');

const expectedLocales = ['ar', 'en', 'es', 'fr', 'de', 'hi', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'pl', 'pt', 'ru', 'sv', 'th', 'tr', 'uk', 'vi'];
if (expectedLocales.length !== 20) throw new Error('Indexing gate locale registry expectation must contain exactly 20 locales.');
const localeDeclaration = i18nSource.match(/export const LOCALES[^=]*=\s*\[([\s\S]*?)\]\s*as const/u)?.[1] ?? '';
const declaredLocales = [...localeDeclaration.matchAll(/['"]([a-z]{2})['"]/gu)].map((match) => match[1]);
if (declaredLocales.length !== expectedLocales.length || expectedLocales.some((locale) => !declaredLocales.includes(locale))) throw new Error(`Indexing locale registry drift: expected=${expectedLocales.join(',')} actual=${declaredLocales.join(',')}`);

if (!originSource.includes('export function getCanonicalSiteOrigin()')) throw new Error('Canonical origin contract is missing getCanonicalSiteOrigin().');
if (!originSource.includes("if (origin.protocol !== 'https:')")) throw new Error('Canonical origin contract must enforce HTTPS.');
if (!originSource.includes("OFFICIAL_PRODUCTION_ORIGIN = 'https://flixoai.vercel.app'")) throw new Error('Canonical origin contract must define the sole official FLIXO production origin.');
if (!originSource.includes('origin.origin !== OFFICIAL_PRODUCTION_ORIGIN')) throw new Error('Canonical origin contract must reject every non-official production origin.');
if (!i18nSource.includes('export const SITE_ORIGIN = getCanonicalSiteOrigin();')) throw new Error('SITE_ORIGIN must come from the canonical origin contract.');
if (!routeResolverSource.includes('export function getToolPath(')) throw new Error('Authoritative getToolPath() resolver is missing.');

if (!sitemapSource.includes('getToolPath(tool, locale)')) throw new Error('Sitemap generator must use getToolPath for localized tool routes.');
if (sitemapSource.includes('getLocalizedToolPath')) throw new Error('Sitemap generator must not depend on deprecated localized tool-path alias.');
if (!sitemapSource.includes('TOOL_MANIFEST.filter((tool) => tool.isReady)')) throw new Error('Sitemap generator does not derive tool URLs from ready TOOL_MANIFEST entries.');
if (!sitemapSource.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) throw new Error('Sitemap generator is missing the hreflang namespace.');
if (!sitemapSource.includes('hreflang="x-default"')) throw new Error('Sitemap generator is missing x-default.');
if (!sitemapSource.includes('const isLocalizedPage = localePrefixPattern.test(path);')) throw new Error('Sitemap alternate emission must be limited to localized routes.');

if (!robotsGeneratorSource.includes("import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';")) throw new Error('robots generator must consume the canonical origin contract.');
if (!robotsGeneratorSource.includes('const origin = getCanonicalSiteOrigin();')) throw new Error('robots generator must resolve its origin through getCanonicalSiteOrigin().');
if (!robotsGeneratorSource.includes('Sitemap: ${origin}/sitemap.xml')) throw new Error('robots generator must publish the canonical sitemap URL.');
if (!robotsSource.includes('User-agent: *\nAllow: /')) throw new Error('robots.txt must permit normal crawling.');

if (!rootSource.includes("name: 'robots'")) throw new Error('Root route is missing robots metadata.');
if (!rootSource.includes('index,follow')) throw new Error('Root route must allow indexing and link following.');
if (!rootSource.includes("property: 'og:title'")) throw new Error('Root route is missing Open Graph title metadata.');
if (!rootSource.includes("property: 'og:description'")) throw new Error('Root route is missing Open Graph description metadata.');
if (!rootSource.includes("property: 'og:url'")) throw new Error('Root route is missing Open Graph URL metadata.');
if (!rootSource.includes("name: 'twitter:card'")) throw new Error('Root route is missing Twitter card metadata.');
if (!rootSource.includes("href: '/favicon.svg'")) throw new Error('Root route is missing the canonical favicon.');

if (!localizedToolRouteSource.includes("path: '/$locale/$tool'")) throw new Error('Localized tool route is missing.');
if (!localizedToolRouteSource.includes("rel: 'canonical'")) throw new Error('Localized tool canonical generation is missing.');
if (!localizedToolRouteSource.includes("hrefLang: 'x-default'")) throw new Error('Localized tool x-default hreflang is missing.');
if (!toolSeoSource.includes('LOCALES.map((alternateLocale)')) throw new Error('Tool SEO alternates must be generated from LOCALES.');
if (!toolSeoSource.includes('getLocalizedToolUrl(alternateLocale, tool.id)')) throw new Error('Tool SEO alternates must use the canonical localized URL helper.');

if (!useCaseRouteSource.includes("path: '/use-cases/$slug'")) throw new Error('Use-case route is not registered.');
if (useCaseRouteSource.includes('hrefLang')) throw new Error('Use-case route must not claim hreflang symmetry until localized use-case routes exist.');
if (!useCaseRouteSource.includes("rel: 'canonical'")) throw new Error('Use-case route must emit a canonical URL.');

if (!indexSource.includes('<html lang="en" dir="ltr">')) throw new Error('index.html must declare the default language and direction.');
if (!indexSource.includes('<meta name="viewport"')) throw new Error('index.html is missing the viewport declaration.');
if (!indexSource.includes('<link rel="manifest" href="/manifest.webmanifest"')) throw new Error('index.html is missing the web manifest.');
if (!indexSource.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg"')) throw new Error('index.html must use the canonical favicon.');
if (indexSource.includes('<title>')) throw new Error('index.html must not inject a competing static title; localized route metadata owns the document title.');

if (!manifestSource.includes('"start_url": "/en"')) throw new Error('Manifest start_url must resolve to a localized public route.');
if (!manifestSource.includes('"src": "/flixo-logo.svg"')) throw new Error('Manifest must use the canonical FLIXO logo asset.');

console.log(`Indexing validation passed: ${expectedLocales.length} locales, ${toolIds.length} canonical tool definitions, canonical getToolPath routing, localized tool canonical/hreflang symmetry, canonical HTTPS origin, and robots/sitemap contracts aligned.`);
