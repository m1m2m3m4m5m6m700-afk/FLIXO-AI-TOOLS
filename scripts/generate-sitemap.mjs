import { mkdirSync, writeFileSync } from 'node:fs';
import { LOCALES, LOCALE_METADATA, SITE_ORIGIN, X_DEFAULT_LOCALE } from '../src/lib/i18n/config.ts';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';
import { USE_CASES } from '../src/lib/seo/use-cases.ts';

const normalizePath = (path) => {
  const value = path.startsWith('/') ? path : `/${path}`;
  return value === '/' ? '/' : value.replace(/\/+$/u, '');
};

const localePrefixPattern = new RegExp(`^/(?:${LOCALES.join('|')})(?=/|$)`);

const localizedPath = (locale, path) => {
  const normalized = normalizePath(path);
  const withoutLocale = normalized.replace(localePrefixPattern, '');
  return `/${locale}${withoutLocale || '/'}`.replace(/\/{2,}/gu, '/');
};

const localizedToolPath = (locale, tool) => getLocalizedToolPath(tool, locale);
const absoluteUrl = (path) => new URL(normalizePath(path), `${SITE_ORIGIN}/`).toString();

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
const toolPaths = readyTools.flatMap((tool) => LOCALES.map((locale) => localizedToolPath(locale, tool)));
const useCasePaths = USE_CASES.flatMap((useCase) => LOCALES.map((locale) => localizedPath(locale, `/use-cases/${useCase.slug}`)));
const rootPaths = LOCALES.map((locale) => `/${locale}`);
const localizedUrls = [...rootPaths, ...toolPaths, ...useCasePaths];

const unique = (values) => [...new Set(values)];

const alternateLinks = (path) => {
  const links = LOCALES.map((locale) =>
    `    <xhtml:link rel="alternate" hreflang="${LOCALE_METADATA[locale].languageTag}" href="${absoluteUrl(localizedPath(locale, path))}" />`,
  );
  links.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(localizedPath(X_DEFAULT_LOCALE, path))}" />`,
  );
  return links.join('\n');
};

const urls = unique(localizedUrls);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls
  .map((url) => {
    const absolute = absoluteUrl(url);
    const path = new URL(absolute).pathname;
    const pathWithoutLocale = path.replace(localePrefixPattern, '') || '/';
    return `  <url>\n    <loc>${absolute}</loc>\n${alternateLinks(pathWithoutLocale)}\n  </url>`;
  })
  .join('\n')}\n</urlset>\n`;

mkdirSync('public', { recursive: true });
writeFileSync('public/sitemap.xml', xml, 'utf8');
console.log(
  `Generated sitemap with ${urls.length} localized URLs (${readyTools.length} ready tools, ${LOCALES.length} locales, ${USE_CASES.length} use cases) with hreflang alternates.`,
);
