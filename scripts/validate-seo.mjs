import { existsSync, readFileSync } from 'node:fs';

const imageSource = readFileSync('src/config/tool-definitions/image.ts', 'utf8');
const seoSource = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');
const catalogSource = readFileSync('src/lib/seo/tool-catalog.ts', 'utf8');
const routerSource = readFileSync('src/routes/localized-tool.tsx', 'utf8');
const localizedPageSource = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');
const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');
const config = readFileSync('src/lib/i18n/config.ts', 'utf8');

const locales = config.match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1]?.match(/'([a-z]{2})'/gu)?.map((value) => value.slice(1, -1)) ?? [];
const expectedLocales = ['ar','en','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
if (JSON.stringify(locales) !== JSON.stringify(expectedLocales)) { console.error(`Canonical locale registry mismatch: ${locales.join(',')}`); process.exit(1); }

const readyToolIds = [...imageSource.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/gu)].map((match) => match[1]);
if (!readyToolIds.length) { console.error('No ready image tools discovered.'); process.exit(1); }
if (new Set(readyToolIds).size !== readyToolIds.length) { console.error('Duplicate ready image tool ids detected.'); process.exit(1); }

const labels = seoSource.match(/const LOCALE_LABELS: Record<string, string> = \{([\s\S]*?)\n\};/u)?.[1] ?? '';
for (const locale of expectedLocales) if (!new RegExp(`\\b${locale}:\\s*'`, 'u').test(labels)) { console.error(`SEO locale label missing: ${locale}`); process.exit(1); }
if (!seoSource.includes("export type ToolCategory = 'Images'")) { console.error('SEO taxonomy is not Image-only.'); process.exit(1); }
if (/'AI'|'Other'|'PDF'|'CSV'|'audio'|'video'/u.test(seoSource)) { console.error('Legacy SEO taxonomy/media surface remains.'); process.exit(1); }
if (!catalogSource.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) { console.error('SEO catalog does not generate all canonical locales.'); process.exit(1); }
if (!catalogSource.includes("seoStatus: 'complete'")) { console.error('SEO catalog completeness marker is missing.'); process.exit(1); }
if (!routerSource.includes("path: '/$locale/$tool'")) { console.error('Localized tool route is not registered.'); process.exit(1); }
if (!routerSource.includes("rel: 'canonical'")) { console.error('Canonical link generation is missing.'); process.exit(1); }
if (!routerSource.includes("hrefLang: 'x-default'")) { console.error('x-default hreflang is missing.'); process.exit(1); }
if (!/<script\s+type=["']application\/ld\+json["']/u.test(localizedPageSource) || !localizedPageSource.includes('seo.structuredData')) { console.error('Localized tool JSON-LD rendering is missing.'); process.exit(1); }
if (!/<script\s+type=["']application\/ld\+json["']/u.test(rootSource) || !rootSource.includes("'@type': 'Organization'") || !rootSource.includes("'@type': 'WebSite'")) { console.error('Global Organization/WebSite structured data is missing.'); process.exit(1); }
for (const legacy of ['src/config/tool-definitions/pdf.ts','src/config/tool-definitions/audio.ts','src/config/tool-definitions/video.ts','src/config/tool-definitions/ai.ts','src/config/tool-definitions/other.ts']) if (existsSync(legacy)) { console.error(`Legacy tool family remains: ${legacy}`); process.exit(1); }

console.log(`SEO validation passed: ${expectedLocales.length} canonical locales, ${readyToolIds.length} ready image tools, localized routing, canonical/hreflang, JSON-LD, and Image-only taxonomy.`);
