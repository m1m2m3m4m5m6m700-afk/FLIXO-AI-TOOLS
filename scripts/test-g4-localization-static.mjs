import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd();
const fail = (message) => { console.error(`G4 FAIL: ${message}`); process.exit(1); };
const pass = (message) => console.log(`G4 PASS: ${message}`);
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });

const expectedLocales = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
const rtlLocales = new Set(['ar', 'ur']);

if (!existsSync('dist/sitemap.xml')) fail('dist/sitemap.xml is missing.');
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
if (!sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) fail('sitemap missing XHTML hreflang namespace.');

const configText = readFileSync('src/lib/i18n/config.ts', 'utf8');
const localeMatch = configText.match(/export const LOCALES = \[([^\]]+)\]/u);
if (!localeMatch) fail('canonical LOCALES declaration is missing.');
const locales = [...localeMatch[1].matchAll(/["']([a-z]{2}(?:-[A-Z]{2})?)["']/gu)].map((m) => m[1]);
if (locales.length !== 20 || locales.join('|') !== expectedLocales.join('|')) fail(`canonical locale registry mismatch: ${locales.join(', ')}`);
const metadata = new Map([...configText.matchAll(/([a-z]{2}): \{ languageTag: '([^']+)', direction: '(ltr|rtl)' \}/gu)].map((m) => [m[1], { languageTag: m[2], direction: m[3] }]));
if (metadata.size !== 20) fail(`expected 20 locale metadata entries, found ${metadata.size}`);
for (const locale of locales) {
  const entry = metadata.get(locale);
  if (!entry) fail(`missing locale metadata: ${locale}`);
  const expectedDirection = rtlLocales.has(locale) ? 'rtl' : 'ltr';
  if (entry.direction !== expectedDirection) fail(`wrong direction for ${locale}: ${entry.direction}`);
}
pass('20-locale canonical registry + direction metadata');

for (const locale of locales) if (!existsSync(`src/lib/i18n/locales/${locale}.ts`)) fail(`missing locale resource: ${locale}.ts`);
pass('20 locale resource files');

run('npm', ['run', 'verify:i18n', '--', '--strict', '--report']);
run('node', ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-google-multilingual-seo.mjs']);
run('npm', ['run', 'validate:seo']);
run('npm', ['run', 'validate:seo-manifest']);
run('npm', ['run', 'validate:use-case-seo']);
run('npm', ['run', 'validate:indexing']);
run('npm', ['run', 'validate:breadcrumb-seo']);
run('npm', ['run', 'validate:locale-integrity']);
run('npm', ['run', 'validate:locale-navigation']);
run('npm', ['run', 'validate:home-i18n']);

const origin = new URL(process.env.VITE_SITE_URL ?? 'https://flixoai.vercel.app').origin;
const blocks = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/gu)];
if (!blocks.length) fail('sitemap contains no URL entries.');
const urls = blocks.map((match) => match[1]);
if (new Set(urls).size !== urls.length) fail('sitemap contains duplicate loc URLs.');
const localePattern = new RegExp(`^/(${locales.join('|')})(?:/|$)`, 'u');
const families = new Map();
for (const match of blocks) {
  const loc = new URL(match[1]);
  if (loc.protocol !== 'https:') fail(`non-HTTPS sitemap URL: ${loc}`);
  if (loc.origin !== origin) fail(`sitemap origin drift: ${loc.origin} != ${origin}`);
  const locale = loc.pathname.match(localePattern)?.[1];
  if (!locale) fail(`sitemap URL is not localized: ${loc}`);
  const body = match[2];
  const links = [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/gu)];
  if (links.length !== 21) fail(`${loc} has ${links.length} hreflang entries; expected 21.`);
  const hrefs = new Map();
  for (const [, tag, href] of links) {
    if (hrefs.has(tag)) fail(`${loc} has duplicate hreflang ${tag}.`);
    hrefs.set(tag, href);
  }
  for (const localeCode of locales) {
    const tag = metadata.get(localeCode).languageTag;
    const href = hrefs.get(tag);
    if (!href) fail(`${loc} missing hreflang ${tag}.`);
    const target = new URL(href);
    if (target.origin !== origin || target.protocol !== 'https:') fail(`${loc} hreflang ${tag} points outside canonical origin: ${href}`);
  }
  const xDefault = hrefs.get('x-default');
  if (!xDefault) fail(`${loc} missing x-default.`);
  const pathWithoutLocale = loc.pathname.replace(localePattern, '/') || '/';
  const expectedXDefault = new URL(`/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`, origin);
  const actualXDefault = new URL(xDefault);
  const normalizePath = (value) => value.replace(/\/+$/u, '') || '/';
  if (actualXDefault.origin !== origin || normalizePath(actualXDefault.pathname) !== normalizePath(expectedXDefault.pathname)) fail(`${loc} x-default mismatch: ${xDefault}`);
  const selfHref = hrefs.get(metadata.get(locale).languageTag);
  if (selfHref !== loc.toString()) fail(`${loc} hreflang self-reference mismatch: ${selfHref}`);
  const familyPath = pathWithoutLocale.replace(/\/+$/u, '') || '/';
  if (!families.has(familyPath)) families.set(familyPath, new Set());
  families.get(familyPath).add(locale);
}
for (const [familyPath, familyLocales] of families) if (familyLocales.size !== 20) fail(`sitemap family ${familyPath} has ${familyLocales.size}/20 locales.`);
pass(`${families.size} public page families × 20 locales = ${families.size * 20} localized URLs`);

const canonicalHost = new URL(process.env.VITE_SITE_URL ?? 'https://flixoai.vercel.app').hostname;
for (const forbidden of ['vercel.sh', 'localhost', '127.0.0.1']) if (sitemap.includes(forbidden)) fail(`forbidden origin leakage detected: ${forbidden}`);
if (canonicalHost !== 'flixoai.vercel.app' && sitemap.includes('flixoai.vercel.app')) fail('canonical sitemap contains stale FLIXO origin.');
pass('canonical origin and preview leakage contract');

console.log(`G4 static certification complete: ${families.size} page families, ${families.size * 20} localized URLs, strict i18n/SEO contracts, reciprocal hreflang, x-default, and canonical origin are enforced.`);
