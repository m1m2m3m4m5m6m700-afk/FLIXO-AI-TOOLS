import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.cwd());
const strict = process.argv.includes('--strict') || Boolean(process.env.VITE_ADSENSE_PUBLISHER_ID?.trim());
const errors = [];
const warnings = [];
const importTs = async (file) => import(pathToFileURL(join(root, file)).href);
const words = (value) => String(value ?? '').replace(/<[^>]+>/gu, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
const issue = (message) => (strict ? errors : warnings).push(message);

const config = await importTs('src/lib/i18n/config.ts');
const locales = [...(config.LOCALES ?? [])];
const manifestModule = await importTs('src/config/tool-manifest.ts');
const manifest = [...(manifestModule.TOOL_MANIFEST ?? [])];
const seoManifestModule = await importTs('src/lib/seo/tool-manifests.ts');
const seoManifests = [...(seoManifestModule.TOOL_SEO_MANIFESTS ?? [])];
const readyTools = manifest.filter((tool) => tool.isReady !== false);
const readyToolIds = new Set(readyTools.map((tool) => tool.id));
const seoByTool = new Map(seoManifests.map((item) => [item.toolId, item]));
const MIN_SUBSTANTIVE_WORDS = 80;

let contentObservations = 0;
let uiObservations = 0;
let present = 0;
for (const tool of readyTools) {
  const seoManifest = seoByTool.get(tool.id);
  for (const locale of locales) {
    const routeKey = `${tool.id}:${locale}`;
    const seo = seoManifest?.seoLocales?.[locale];
    if (!seoManifest) {
      errors.push(`missing generated SEO manifest: ${routeKey}`);
      continue;
    }
    if (seoManifest.status !== 'ready') {
      errors.push(`SEO manifest is not ready: ${routeKey}`);
      continue;
    }
    if (seoManifest.seoStatus !== 'complete') {
      errors.push(`SEO manifest is not complete: ${routeKey}`);
      continue;
    }
    if (!seo) {
      errors.push(`missing generated localized SEO payload: ${routeKey}`);
      continue;
    }
    present += 1;

    for (const field of ['title', 'description', 'intro', 'keywords', 'howTo', 'features', 'altText']) {
      const value = seo[field];
      const empty = Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim();
      if (empty) errors.push(`generated SEO payload missing ${field}: ${routeKey}`);
    }

    const substantiveText = [seo.title, seo.description, seo.intro, ...(seo.keywords ?? []), ...(seo.howTo ?? []), ...(seo.features ?? []), ...(seo.altText ?? [])].join(' ');
    const substantiveWordCount = words(substantiveText).length;
    const observations = [];
    if (substantiveWordCount < MIN_SUBSTANTIVE_WORDS) observations.push(`substantive content ${substantiveWordCount}<${MIN_SUBSTANTIVE_WORDS} words`);
    if (words(seo.description).length < 8) observations.push(`description ${words(seo.description).length}<8 words`);
    if ((seo.howTo?.length ?? 0) < 3) observations.push('howTo has fewer than 3 items');
    if ((seo.features?.length ?? 0) < 3) observations.push('features has fewer than 3 items');
    if (observations.length) {
      contentObservations += observations.length;
      for (const item of observations) issue(`${routeKey}: ${item}`);
    }

    if (!tool.component || !tool.path.startsWith('/en/')) errors.push(`invalid canonical tool route contract: ${routeKey}`);
    if (!existsSync(join(root, 'src/config/registry.ts'))) issue(`registry source unavailable while auditing route: ${routeKey}`);
    uiObservations += 1;
  }
}

for (const seoManifest of seoManifests) {
  if (!readyToolIds.has(seoManifest.toolId)) errors.push(`orphan SEO manifest for non-ready tool: ${seoManifest.toolId}`);
}

const expected = readyTools.length * locales.length;
console.log(`ADSENSE ROUTE AUDIT: ${readyTools.length} ready tools × ${locales.length} locales = ${expected} localized tool routes`);
console.log(`ADSENSE ROUTE AUDIT: ${present}/${expected} generated localized SEO payloads present`);
console.log(`ADSENSE ROUTE AUDIT: ${contentObservations} content-quality observations`);
console.log(`ADSENSE ROUTE AUDIT: ${uiObservations} route/UI contract observations`);
console.log(`ADSENSE ROUTE AUDIT: ${strict ? 'STRICT' : 'FOUNDATION'} mode`);

if (!errors.length) console.log('ADSENSE ROUTE AUDIT PASS: no structural route blockers detected');
if (warnings.length) {
  console.log(`ADSENSE ROUTE AUDIT WARN: ${warnings.length} non-blocking observations`);
  for (const warning of warnings.slice(0, 80)) console.log(`  WARN ${warning}`);
  if (warnings.length > 80) console.log(`  WARN ... ${warnings.length - 80} additional observations omitted`);
}
if (errors.length) {
  console.error(`ADSENSE ROUTE AUDIT FAIL: ${errors.length} blocking issue(s)`);
  for (const error of errors.slice(0, 120)) console.error(`  FAIL ${error}`);
  if (errors.length > 120) console.error(`  FAIL ... ${errors.length - 120} additional issues omitted`);
  process.exit(1);
}
