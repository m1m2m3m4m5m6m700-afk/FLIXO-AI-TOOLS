import { failValidation } from './validation-contracts.mjs';

const PRODUCTION_ORIGIN = process.env.PRODUCTION_ORIGIN ?? 'https://flixoai.vercel.app';
const EXPECTED_ORIGIN = 'https://flixoai.vercel.app';
const EXPECTED_LOCALES = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'];
const timeoutMs = Number(process.env.PRODUCTION_CERT_TIMEOUT_MS ?? 30000);

if (PRODUCTION_ORIGIN !== EXPECTED_ORIGIN) {
  failValidation(`Production certification origin mismatch: expected ${EXPECTED_ORIGIN}, got ${PRODUCTION_ORIGIN}`);
}

const originUrl = new URL(PRODUCTION_ORIGIN);
if (originUrl.protocol !== 'https:' || originUrl.hostname !== 'flixoai.vercel.app' || originUrl.pathname !== '/' || originUrl.search || originUrl.hash) {
  failValidation(`Production origin must be exactly ${EXPECTED_ORIGIN}`);
}

async function fetchText(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${PRODUCTION_ORIGIN}${path}`, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'FLIXO-production-certification/1' },
    });
    const body = await response.text();
    if (!response.ok) failValidation(`${path} returned HTTP ${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== PRODUCTION_ORIGIN || finalUrl.protocol !== 'https:') {
      failValidation(`${path} redirected outside the canonical production origin: ${response.url}`);
    }
    return body;
  } catch (error) {
    failValidation(`Production fetch failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

const robots = await fetchText('/robots.txt');
const sitemap = await fetchText('/sitemap.xml');
const homepage = await fetchText('/en');

const sitemapBinding = `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`;
if (!robots.split(/\r?\n/).some((line) => line.trim() === sitemapBinding)) {
  failValidation(`robots.txt must bind the canonical sitemap: ${sitemapBinding}`);
}

const locs = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1].trim());
if (!locs.length) failValidation('sitemap.xml contains no <loc> entries');

const seen = new Set();
const localeCoverage = new Set();
for (const rawUrl of locs) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    failValidation(`Invalid sitemap URL: ${rawUrl}`);
  }
  if (url.origin !== PRODUCTION_ORIGIN || url.protocol !== 'https:' || url.search || url.hash) {
    failValidation(`Sitemap URL violates canonical production origin: ${rawUrl}`);
  }
  if (/\.vercel\.(app|sh)$/i.test(url.hostname) && url.hostname !== 'flixoai.vercel.app') {
    failValidation(`Preview/deployment hostname leaked into sitemap: ${rawUrl}`);
  }
  if (seen.has(url.href)) failValidation(`Duplicate sitemap URL: ${url.href}`);
  seen.add(url.href);
  const [locale] = url.pathname.split('/').filter(Boolean);
  if (locale) localeCoverage.add(locale);
}

for (const locale of EXPECTED_LOCALES) {
  if (!localeCoverage.has(locale)) failValidation(`Production sitemap is missing locale coverage for ${locale}`);
}
if (localeCoverage.size !== EXPECTED_LOCALES.length) {
  failValidation(`Production sitemap locale coverage is ${localeCoverage.size}/${EXPECTED_LOCALES.length}`);
}

const hreflangs = [...sitemap.matchAll(/hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/g)].map((match) => ({ locale: match[1], href: match[2] }));
if (!hreflangs.some((entry) => entry.locale === 'x-default')) failValidation('Production sitemap is missing x-default hreflang');
for (const entry of hreflangs) {
  const target = new URL(entry.href);
  if (target.origin !== PRODUCTION_ORIGIN || target.protocol !== 'https:' || target.search || target.hash) {
    failValidation(`hreflang target violates canonical origin: ${entry.href}`);
  }
}

const canonicalMatch = homepage.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ?? homepage.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
if (!canonicalMatch) failValidation('Production /en page is missing canonical link');
const canonical = new URL(canonicalMatch[1]);
if (canonical.origin !== PRODUCTION_ORIGIN || canonical.protocol !== 'https:' || canonical.search || canonical.hash) {
  failValidation(`Production /en canonical violates the production origin: ${canonical.href}`);
}

const htmlLang = homepage.match(/<html[^>]+\blang=["']([^"']+)["']/i)?.[1];
if (htmlLang !== 'en') failValidation(`Production /en html lang must be en, got ${htmlLang ?? 'missing'}`);

console.log(`Production certification passed: ${EXPECTED_ORIGIN}, ${EXPECTED_LOCALES.length} locale coverage, canonical sitemap binding, HTTPS-only URLs, no preview leakage, x-default, and /en canonical/lang.`);
