import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, LOCALE_METADATA, X_DEFAULT_LOCALE, getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const SITE_ORIGIN = getCanonicalSiteOrigin();
const outputDir = process.env.FLIXO_GENERATED_OUTPUT_DIR?.trim() || 'public';

const unique = (values) => [...new Set(values)];

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

const absoluteUrl = (path) => new URL(normalizePath(path), `${SITE_ORIGIN}/`).toString();

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
const localizedToolPaths = readyTools.flatMap((tool) => LOCALES.map((locale) => getLocalizedToolPath(tool, locale)));
const localizedHomePaths = LOCALES.map((locale) => localizedPath(locale, '/'));
const urls = unique([...localizedHomePaths, ...localizedToolPaths]);

const localizedAlternateLinks = (path) => {
  const links = LOCALES.map((locale) =>
    `    <xhtml:link rel="alternate" hreflang="${LOCALE_METADATA[locale].languageTag}" href="${absoluteUrl(localizedPath(locale, path))}" />`,
  );
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(localizedPath(X_DEFAULT_LOCALE, path))}" />`);
  return links.join('\n');
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls
  .map((url) => {
    const absolute = absoluteUrl(url);
    const path = new URL(absolute).pathname;
    const pathWithoutLocale = path.replace(localePrefixPattern, '') || '/';
    const isLocalizedPage = localePrefixPattern.test(path);
    const alternates = isLocalizedPage ? localizedAlternateLinks(pathWithoutLocale) : '';
    return `  <url>\n    <loc>${absolute}</loc>${alternates ? `\n${alternates}` : ''}\n  </url>`;
  })
  .join('\n')}\n</urlset>\n`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'sitemap.xml'), xml, 'utf8');
console.log(
  `Generated sitemap with ${urls.length} localized URLs (${readyTools.length} ready tools, ${LOCALES.length} locales) using canonical route/origin contracts at ${outputDir}/sitemap.xml.`,
);
