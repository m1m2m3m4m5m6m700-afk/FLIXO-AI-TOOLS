import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const importTs = async (file) => import(pathToFileURL(`${root}/${file}`).href);
const { LOCALES } = await importTs('src/lib/i18n/config.ts');
const { TOOL_SEO_MANIFESTS } = await importTs('src/lib/seo/tool-manifests.ts');
const { TOOL_MANIFEST } = await importTs('src/config/tool-manifest.ts');

const readyIds = new Set(TOOL_MANIFEST.filter((tool) => tool.isReady !== false).map((tool) => tool.id));
const errors = [];
const warnings = [];
const tokenize = (value) => String(value ?? '').toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
const shingles = (tokens, size = 3) => {
  const out = new Set();
  for (let i = 0; i <= tokens.length - size; i += 1) out.add(tokens.slice(i, i + size).join(' '));
  return out;
};
const jaccard = (a, b) => {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / union.size;
};

const byLocale = new Map(LOCALES.map((locale) => [locale, []]));
for (const manifest of TOOL_SEO_MANIFESTS) {
  if (!readyIds.has(manifest.toolId)) continue;
  for (const locale of LOCALES) {
    const seo = manifest.seoLocales?.[locale];
    if (!seo) {
      errors.push(`missing SEO locale payload: ${manifest.toolId}:${locale}`);
      continue;
    }
    const tokens = tokenize(`${seo.title} ${seo.description} ${seo.intro} ${seo.keywords.join(' ')} ${seo.features.join(' ')} ${seo.howTo.join(' ')}`);
    byLocale.get(locale)?.push({ toolId: manifest.toolId, shingles: shingles(tokens) });
  }
}

let comparisons = 0;
let highSimilarityPairs = 0;
for (const [locale, entries] of byLocale) {
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      comparisons += 1;
      const score = jaccard(entries[i].shingles, entries[j].shingles);
      if (score >= 0.82) {
        highSimilarityPairs += 1;
        warnings.push(`${locale}: high content similarity ${entries[i].toolId} ↔ ${entries[j].toolId} = ${score.toFixed(3)}`);
      }
      if (score >= 0.92) errors.push(`${locale}: near-duplicate content ${entries[i].toolId} ↔ ${entries[j].toolId} = ${score.toFixed(3)}`);
    }
  }
}

console.log(`CONTENT QUALITY: ${TOOL_SEO_MANIFESTS.filter((manifest) => readyIds.has(manifest.toolId)).length} tool manifests × ${LOCALES.length} locales audited.`);
console.log(`CONTENT QUALITY: ${comparisons} within-locale content comparisons; ${highSimilarityPairs} high-similarity pair(s).`);
console.log('CONTENT QUALITY: similarity is a detection signal, not a ranking score; human editorial review remains required.');
for (const warning of warnings.slice(0, 80)) console.log(`CONTENT WARN: ${warning}`);
if (warnings.length > 80) console.log(`CONTENT WARN: ... ${warnings.length - 80} additional warnings omitted`);
for (const error of errors) console.error(`CONTENT FAIL: ${error}`);
if (errors.length) process.exit(1);
console.log('CONTENT QUALITY PASS');
