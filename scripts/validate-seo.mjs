import { readFileSync } from 'node:fs';

const toolFamilyFiles = [
  'src/config/tool-definitions/image.ts',
  'src/config/tool-definitions/pdf.ts',
  'src/config/tool-definitions/audio.ts',
  'src/config/tool-definitions/video.ts',
  'src/config/tool-definitions/ai.ts',
  'src/config/tool-definitions/other.ts',
];

const toolsSource = toolFamilyFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
const seoSource = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');
const routerSource = readFileSync('src/routes/localized-tool.tsx', 'utf8');
const localizedPageSource = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');

const expectedLocales = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
const readyToolIds = [...toolsSource.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);

if (readyToolIds.length === 0) {
  console.error('No ready tools discovered in split registry family files.');
  process.exit(1);
}

const uniqueReadyTools = new Set(readyToolIds);
if (uniqueReadyTools.size !== readyToolIds.length) {
  console.error('Duplicate ready tool ids detected.');
  process.exit(1);
}

const labelsBlockMatch = seoSource.match(/const LOCALE_LABELS: Record<Locale, string> = \{([\s\S]*?)\n\};/);
if (!labelsBlockMatch) {
  console.error('LOCALE_LABELS registry is missing or malformed.');
  process.exit(1);
}

let previousIndex = -1;
for (const locale of expectedLocales) {
  const marker = `${locale}: '`;
  const index = labelsBlockMatch[1].indexOf(marker);
  if (index === -1) {
    console.error(`SEO locale label is missing: ${locale}`);
    process.exit(1);
  }
  if (index <= previousIndex) {
    console.error(`SEO locale labels are out of canonical order at: ${locale}`);
    process.exit(1);
  }
  previousIndex = index;
}

if (!routerSource.includes("path: '/$locale/$tool'")) {
  console.error('Multilingual tool route is not registered.');
  process.exit(1);
}

if (!routerSource.includes("rel: 'canonical'")) {
  console.error('Canonical link generation is missing.');
  process.exit(1);
}

if (!routerSource.includes("hrefLang: 'x-default'")) {
  console.error('x-default hreflang is missing.');
  process.exit(1);
}

const jsonLdScriptPattern = /<script\s+type=["']application\/ld\+json["']/;
if (!jsonLdScriptPattern.test(localizedPageSource)) {
  console.error('Structured data JSON-LD is missing from the rendered localized tool page.');
  process.exit(1);
}

if (!localizedPageSource.includes('seo.structuredData')) {
  console.error('Localized tool page does not render the SEO structured-data payload.');
  process.exit(1);
}

if (!jsonLdScriptPattern.test(rootSource) || !rootSource.includes("'@type': 'Organization'") || !rootSource.includes("'@type': 'WebSite'")) {
  console.error('Global Organization/WebSite structured data is missing from the root route.');
  process.exit(1);
}

console.log(`SEO validation passed: ${expectedLocales.length} locales, ${readyToolIds.length} ready tools, dynamic localized routing, canonical, hreflang, tool JSON-LD, and global WebSite/Organization JSON-LD present.`);
