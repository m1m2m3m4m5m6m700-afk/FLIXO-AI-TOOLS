import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const importTs = async (file) => import(pathToFileURL(join(root, file)).href);
const { LOCALES } = await importTs('src/lib/i18n/config.ts');
const { TOOL_SEO_MANIFESTS } = await importTs('src/lib/seo/tool-manifests.ts');
const { TOOL_MANIFEST } = await importTs('src/config/tool-manifest.ts');

const readyIds = new Set(TOOL_MANIFEST.filter((tool) => tool.isReady !== false).map((tool) => tool.id));
const manifests = TOOL_SEO_MANIFESTS.filter((manifest) => readyIds.has(manifest.toolId));
const errors = [];

function removeElementContent(source, tagName) {
  const lower = source.toLowerCase();
  const startToken = `<${tagName}`;
  const endToken = `</${tagName}`;
  let cursor = 0;
  let output = '';
  while (cursor < source.length) {
    const start = lower.indexOf(startToken, cursor);
    if (start < 0) { output += source.slice(cursor); break; }
    output += source.slice(cursor, start);
    const end = lower.indexOf(endToken, start + startToken.length);
    if (end < 0) break;
    const close = lower.indexOf('>', end + endToken.length);
    cursor = close < 0 ? source.length : close + 1;
  }
  return output;
}

function stripHtml(value) {
  let output = String(value);
  output = removeElementContent(output, 'script');
  output = removeElementContent(output, 'style');
  output = output.replace(/<[^>]+>/gu, ' ');
  output = output.replace(/&(?:amp|lt|gt|quot|#39);/gu, ' ');
  return output.replace(/\s+/gu, ' ').trim();
}

const textLength = (value) => stripHtml(value).replace(/\s+/gu, ' ').trim().length;

let checked = 0;
for (const manifest of manifests) {
  for (const locale of LOCALES) {
    const file = join(dist, locale, manifest.slug, 'index.html');
    const key = `${locale}/${manifest.slug}`;
    if (!existsSync(file)) {
      errors.push(`${key}: missing prerendered HTML`);
      continue;
    }

    const seo = manifest.seoLocales?.[locale];
    if (!seo) errors.push(`${key}: missing canonical SEO payload`);
    else {
      if (textLength(seo.title) < 10) errors.push(`${key}: SEO title is too short`);
      if (textLength(seo.description) < 40) errors.push(`${key}: SEO description is too short`);
      if (textLength(seo.intro) < 40) errors.push(`${key}: SEO intro is too short`);
      if (!Array.isArray(seo.howTo) || seo.howTo.length < 4 || seo.howTo.some((item) => textLength(item) < 8)) errors.push(`${key}: howTo payload is incomplete`);
      if (!Array.isArray(seo.features) || seo.features.length < 3 || seo.features.some((item) => textLength(item) < 5)) errors.push(`${key}: features payload is incomplete`);
      if (!Array.isArray(seo.altText) || seo.altText.length < 1 || seo.altText.some((item) => textLength(item) < 5)) errors.push(`${key}: altText payload is incomplete`);
    }

    const html = readFileSync(file, 'utf8');
    const main = html.match(/<main\b[\s\S]*?<\/main\s*>/iu)?.[0] ?? '';
    const h1s = (main.match(/<h1\b/giu) ?? []).length;
    const h2s = (main.match(/<h2\b/giu) ?? []).length;
    const links = (main.match(/<a\b[^>]*href="\//giu) ?? []).length;
    const visible = stripHtml(main);

    if (h1s !== 1) errors.push(`${key}: expected exactly one H1, found ${h1s}`);
    if (h2s < 3) errors.push(`${key}: expected at least 3 section headings, found ${h2s}`);
    if (links < 2) errors.push(`${key}: expected at least 2 internal discovery links, found ${links}`);
    if (!main.includes('data-flixo-prerendered="true"')) errors.push(`${key}: missing prerender marker`);
    if (visible.length < 300) errors.push(`${key}: prerendered visible content is structurally too small (<300 characters)`);

    const paragraphs = [];
    for (const paragraph of main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/giu)) {
      const normalized = stripHtml(paragraph[1]).toLocaleLowerCase();
      if (normalized.length >= 60) paragraphs.push(normalized);
    }
    const uniqueParagraphs = new Set(paragraphs);
    if (uniqueParagraphs.size !== paragraphs.length) errors.push(`${key}: repeated substantial paragraph detected`);

    checked += 1;
  }
}

const localeCount = readdirSync(dist, { withFileTypes: true }).filter((entry) => entry.isDirectory() && LOCALES.includes(entry.name)).length;
if (localeCount !== LOCALES.length) errors.push(`dist contains ${localeCount} locale directories; expected ${LOCALES.length}`);

console.log(`PRERENDER CONTENT: ${checked}/${manifests.length * LOCALES.length} localized pages inspected.`);
if (errors.length) {
  for (const error of errors.slice(0, 160)) console.error(`PRERENDER CONTENT FAIL: ${error}`);
  if (errors.length > 160) console.error(`PRERENDER CONTENT FAIL: ... ${errors.length - 160} additional issue(s)`);
  process.exit(1);
}
console.log('PRERENDER CONTENT PASS: every localized page has a complete SEO payload, structured visible content, and internal discovery links.');
