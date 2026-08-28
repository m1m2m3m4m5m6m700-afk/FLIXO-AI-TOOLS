import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.cwd());
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.log('PRERENDER SEO: dist is missing; running the canonical build before validation.');
  execFileSync(process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'node_modules/vite/bin/vite.js', 'build'], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/prerender-seo-pages.mjs'], { cwd: root, stdio: 'inherit' });
}

const htmlFiles = [];
for (const localeEntry of readdirSync(dist, { withFileTypes: true })) {
  if (!localeEntry.isDirectory()) continue;
  const locale = localeEntry.name;
  const localeDir = join(dist, locale);
  for (const slugEntry of readdirSync(localeDir, { withFileTypes: true })) {
    if (!slugEntry.isDirectory()) continue;
    const file = join(localeDir, slugEntry.name, 'index.html');
    if (existsSync(file)) htmlFiles.push({ locale, slug: slugEntry.name, file });
  }
}

const localeSet = new Set(htmlFiles.map((entry) => entry.locale));
const locales = [...localeSet].sort();
const enPages = htmlFiles.filter((entry) => entry.locale === 'en').sort((a, b) => a.slug.localeCompare(b.slug));
const errors = [];
const warnings = [];

if (!existsSync(join(dist, 'index.html'))) errors.push('dist/index.html is still missing after build');
if (enPages.length === 0) errors.push('no prerendered English tool pages were found');
if (locales.length !== 20) errors.push(`expected 20 prerendered locales, found ${locales.length}: ${locales.join(', ')}`);

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1] ?? null;
}

function extractLinks(html) {
  const matches = html.match(/<link\s+rel="alternate"\s+[^>]*>/giu) ?? [];
  return matches.map((tag) => ({
    language: firstMatch(tag, /hreflang="([^"]+)"/iu),
    href: firstMatch(tag, /href="([^"]+)"/iu),
  }));
}

const referenceBySlug = new Map();
for (const entry of enPages) {
  const html = readFileSync(entry.file, 'utf8');
  const canonical = firstMatch(html, /<link\s+rel="canonical"\s+href="([^"]+)"/iu);
  const alternates = extractLinks(html);
  if (!canonical) errors.push(`en/${entry.slug}: missing canonical link`);
  if (alternates.length !== 21) errors.push(`en/${entry.slug}: expected 21 hreflang links including x-default, found ${alternates.length}`);
  referenceBySlug.set(entry.slug, { canonical, alternates });
}

const expectedPageCount = enPages.length * locales.length;
let checked = 0;

for (const entry of htmlFiles) {
  const html = readFileSync(entry.file, 'utf8');
  const label = `${entry.locale}/${entry.slug}`;
  const reference = referenceBySlug.get(entry.slug);
  if (!reference) {
    errors.push(`${label}: no English reference page exists`);
    continue;
  }

  const canonical = firstMatch(html, /<link\s+rel="canonical"\s+href="([^"]+)"/iu);
  const description = firstMatch(html, /<meta\s+name="description"\s+content="([^"]+)"/iu);
  const h1Count = (html.match(/<h1(?:\s[^>]*)?>/giu) ?? []).length;
  const jsonLdCount = (html.match(/application\/ld\+json/giu) ?? []).length;
  const alternates = extractLinks(html);

  if (!canonical) errors.push(`${label}: missing canonical link`);
  if (!description || description.trim().length < 10) errors.push(`${label}: missing or implausibly short meta description`);
  if (h1Count !== 1) errors.push(`${label}: expected exactly 1 H1, found ${h1Count}`);
  if (jsonLdCount < 1) errors.push(`${label}: missing JSON-LD structured data`);
  if (!html.includes('data-flixo-prerendered="true"')) errors.push(`${label}: missing prerender marker`);
  if (!html.includes('<main')) errors.push(`${label}: missing main landmark`);

  const expectedCanonicalSuffix = `/${entry.locale}/${entry.slug}`;
  if (canonical && !canonical.endsWith(expectedCanonicalSuffix)) {
    errors.push(`${label}: canonical path mismatch (${canonical})`);
  }

  if (entry.locale === 'en') {
    const lang = firstMatch(html, /<html[^>]*\slang="([^"]+)"/iu);
    if (lang !== 'en') errors.push(`${label}: expected html lang="en", found ${lang ?? 'missing'}`);
  }

  if (alternates.length !== 21) errors.push(`${label}: expected 21 hreflang links including x-default, found ${alternates.length}`);
  const languages = alternates.map((item) => item.language).filter(Boolean);
  if (new Set(languages).size !== languages.length) errors.push(`${label}: duplicate hreflang values detected`);

  const referenceLanguages = reference.alternates.map((item) => item.language).filter(Boolean).sort();
  const actualLanguages = [...languages].sort();
  if (referenceLanguages.join('|') !== actualLanguages.join('|')) {
    errors.push(`${label}: hreflang language cluster differs from English reference`);
  }

  const referenceOrigin = reference.canonical ? new URL(reference.canonical).origin : null;
  for (const alternate of alternates) {
    if (!alternate.href || !alternate.language) continue;
    try {
      const target = new URL(alternate.href);
      if (referenceOrigin && target.origin !== referenceOrigin) errors.push(`${label}: ${alternate.language} points outside canonical origin`);
      if (alternate.language === 'x-default') {
        if (!target.pathname.endsWith(`/en/${entry.slug}`)) errors.push(`${label}: x-default does not target /en/${entry.slug}`);
      } else if (!target.pathname.endsWith(`/${entry.locale}/${entry.slug}`) && entry.locale === 'en') {
        warnings.push(`${label}: reference alternate ${alternate.language} is cross-locale as expected`);
      }
    } catch {
      errors.push(`${label}: invalid hreflang URL: ${alternate.href}`);
    }
  }

  checked += 1;
}

const expectedSlugs = new Set(enPages.map((entry) => entry.slug));
for (const locale of locales) {
  const actual = new Set(htmlFiles.filter((entry) => entry.locale === locale).map((entry) => entry.slug));
  for (const slug of expectedSlugs) if (!actual.has(slug)) errors.push(`${locale}/${slug}: missing localized prerendered page`);
  for (const slug of actual) if (!expectedSlugs.has(slug)) errors.push(`${locale}/${slug}: unexpected prerendered page not present in English set`);
}

console.log(`PRERENDER SEO CHECK: ${checked}/${expectedPageCount} localized tool pages checked`);
console.log(`PRERENDER SEO CHECK: ${enPages.length} tool routes × ${locales.length} locales`);
if (warnings.length) console.log(`PRERENDER SEO CHECK: ${warnings.length} non-blocking observations`);
if (errors.length) {
  for (const error of errors.slice(0, 120)) console.error(`PRERENDER SEO FAIL: ${error}`);
  if (errors.length > 120) console.error(`PRERENDER SEO FAIL: ... ${errors.length - 120} additional issue(s)`);
  process.exit(1);
}
console.log('PRERENDER SEO PASS: prerendered HTML is present for every locale/tool pair with canonical metadata, complete hreflang coverage, one H1, and JSON-LD.');