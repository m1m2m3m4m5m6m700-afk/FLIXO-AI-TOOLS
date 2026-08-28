import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const requested = process.env.FLIXO_LOCALE ?? process.argv.slice(2).find((v) => CANONICAL_LOCALES.includes(v));
const targets = requested ? [requested] : CANONICAL_LOCALES;
const allMode = !requested;
const strict = args.has('--strict') || allMode;
const report = args.has('--report');
const json = args.has('--json');
const errors = [];
const normalize = (v) => String(v).replace(/\s+/gu, ' ').trim();
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const directionFor = (l) => (l === 'ar' || l === 'ur' ? 'rtl' : 'ltr');
const nonTranslatable = new Set(['locale', 'localeCode', 'languageCode', 'languageTag', 'direction', 'dir']);
const allowedSame = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'AI', 'English', 'Ctrl K', 'Smart Intent', 'SVG', 'PNG', 'JPG', 'JPEG', 'WEBP', 'MP3', 'MP4', 'HTTP', 'HTTPS', 'URL', 'API', 'JSON']);
const scriptRules = { ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u, ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u, ru: /[\u0400-\u04ff]/u, zh: /[\u3400-\u9fff]/u, ja: /[\u3040-\u30ff\u3400-\u9fff]/u, ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u, hi: /[\u0900-\u097f]/u, th: /[\u0e00-\u0e7f]/u };
const importTs = async (p) => import(pathToFileURL(join(root, p)).href);
const read = (p) => readFileSync(join(root, p), 'utf8');
const issue = (locale, kind, area, message) => errors.push({ locale, kind, area, message });

function placeholders(v) { return [...String(v).matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((m) => m[0]).sort().join('|'); }
function tags(v) { return [...String(v).matchAll(/<\/?[a-z][^>]*>/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim()).join('|'); }
function leaves(v, path = []) {
  if (typeof v === 'string') return [{ path: path.join('.'), value: v }];
  if (!isObject(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, k]));
}
function compare(a, b, locale, area, path = '') {
  if (typeof a !== typeof b) { issue(locale, 'structural', area, `type mismatch at ${path}`); return; }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) issue(locale, 'structural', area, `array mismatch at ${path}`);
    if (Array.isArray(b)) for (let i = 0; i < Math.min(a.length, b.length); i++) compare(a[i], b[i], locale, area, `${path}[${i}]`);
    return;
  }
  if (isObject(a)) {
    if (!isObject(b)) { issue(locale, 'structural', area, `object mismatch at ${path}`); return; }
    for (const k of Object.keys(a)) if (!(k in b)) issue(locale, 'missing', area, `missing key ${path ? `${path}.` : ''}${k}`);
    for (const k of Object.keys(b)) if (!(k in a)) issue(locale, 'orphan', area, `orphan key ${path ? `${path}.` : ''}${k}`);
    for (const k of Object.keys(a)) if (k in b) compare(a[k], b[k], locale, area, path ? `${path}.${k}` : k);
    return;
  }
  if (typeof a !== 'string') return;
  const leaf = path.split('.').at(-1) ?? path;
  const localized = normalize(b);
  if (!localized && !nonTranslatable.has(leaf)) issue(locale, 'missing', area, `empty translation at ${path}`);
  if (locale !== 'en' && localized && a === b && !allowedSame.has(localized) && !nonTranslatable.has(leaf)) issue(locale, 'fallback', area, `exact English fallback at ${path}`);
  if (placeholders(a) !== placeholders(b)) issue(locale, 'placeholder', area, `placeholder mismatch at ${path}`);
  if (tags(a) !== tags(b)) issue(locale, 'html', area, `HTML structure mismatch at ${path}`);
}
function entry(source, locale, marker) { return new RegExp(`\\b${locale}:\\s*${marker}\\(\\{([\\s\\S]*?)\\}\\)`, 'u').exec(source)?.[1] ?? ''; }
function value(body, key) { return body.match(new RegExp(`${key}\\s*['\"]([^'\"\\n]*)['\"]`, 'u'))?.[1] ?? ''; }
function keys(body, required, locale, area) { if (!body) { issue(locale, 'missing', area, `missing locale entry`); return; } for (const k of required) if (!body.includes(k)) issue(locale, 'missing', area, `missing ${k}`); }

const config = await importTs('src/lib/i18n/config.ts');
const runtimeLocales = [...(config.LOCALES ?? [])];
if (runtimeLocales.length !== CANONICAL_LOCALES.length || runtimeLocales.some((v, i) => v !== CANONICAL_LOCALES[i])) for (const l of targets) issue(l, 'registry', 'runtime', `locale registry drift: ${runtimeLocales.join(', ')}`);
const en = (await importTs('src/lib/i18n/locales/en.ts')).en;
const homeSource = read('src/data/home-locales.ts');
const quickSource = read('src/data/quickflow-locales.ts');
const uiSource = read('src/data/tool-ui-i18n.ts');
const seoRegistry = read('src/lib/i18n/tool-seo-localization.ts');
const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
const quickKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
const uiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];

const toolSeoFiles = [];
const toolsDir = join(root, 'src/tools');
if (existsSync(toolsDir)) for (const tool of readdirSync(toolsDir, { withFileTypes: true })) {
  if (!tool.isDirectory() || tool.name.startsWith('_')) continue;
  const dir = join(toolsDir, tool.name, 'seo');
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (/^[a-z]{2}\.ts$/u.test(f)) toolSeoFiles.push(`src/tools/${tool.name}/seo/${f}`);
}
const toolIds = [...new Set(toolSeoFiles.map((f) => f.split('/')[2]))];

for (const locale of targets) {
  const metadata = config.LOCALE_METADATA?.[locale];
  if (!metadata) issue(locale, 'direction', 'runtime', 'missing locale metadata');
  else {
    if (metadata.direction !== directionFor(locale)) issue(locale, 'direction', 'runtime', `expected ${directionFor(locale)}, found ${metadata.direction}`);
    if (!metadata.languageTag) issue(locale, 'direction', 'runtime', 'missing languageTag');
  }

  const path = `src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(join(root, path))) issue(locale, 'missing', 'dictionary', `missing ${path}`);
  else {
    const localized = (await importTs(path))[locale];
    if (!localized) issue(locale, 'missing', 'dictionary', `missing ${locale} export`);
    else {
      if (localized.locale !== locale) issue(locale, 'structural', 'dictionary', `locale identity is ${localized.locale}`);
      if (localized.direction !== directionFor(locale)) issue(locale, 'direction', 'dictionary', `expected ${directionFor(locale)}, found ${localized.direction}`);
      compare(en, localized, locale, 'core dictionary');
      const script = scriptRules[locale];
      if (script && locale !== 'en') for (const leaf of leaves(localized)) {
        const text = normalize(leaf.value); const letters = [...text].filter((c) => /\p{L}/u.test(c));
        if (letters.length >= 10 && !script.test(text) && !allowedSame.has(text) && !nonTranslatable.has(leaf.path.split('.').at(-1) ?? '')) issue(locale, 'fallback', 'script', `expected ${locale} script absent at ${leaf.path}`);
      }
    }
  }

  const home = entry(homeSource, locale, 'copy');
  keys(home, homeKeys, locale, 'Home');
  const quick = entry(quickSource, locale, 'q');
  keys(quick, quickKeys, locale, 'QuickFlow');
  const ui = new RegExp(`\\b${locale}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`, 'u').exec(uiSource)?.[1] ?? '';
  keys(ui, uiKeys, locale, 'Tool UI');

  if (locale !== 'en') {
    for (const k of homeKeys) { const a = value(entry(homeSource, 'en', 'copy'), k); const b = value(home, k); if (a && a === b && !allowedSame.has(b)) issue(locale, 'fallback', 'Home', `English fallback in ${k}`); if (a && placeholders(a) !== placeholders(b)) issue(locale, 'placeholder', 'Home', `placeholder mismatch in ${k}`); if (a && tags(a) !== tags(b)) issue(locale, 'html', 'Home', `HTML mismatch in ${k}`); }
    for (const k of quickKeys) { const a = value(entry(quickSource, 'en', 'q'), k); const b = value(quick, k); if (a && a === b && k !== 'resultAlt:' && !allowedSame.has(b)) issue(locale, 'fallback', 'QuickFlow', `English fallback in ${k}`); if (a && placeholders(a) !== placeholders(b)) issue(locale, 'placeholder', 'QuickFlow', `placeholder mismatch in ${k}`); }
  }

  const seoForLocale = toolSeoFiles.filter((f) => f.endsWith(`/${locale}.ts`));
  if (seoForLocale.length !== toolIds.length) issue(locale, 'seo', 'tool SEO', `coverage ${seoForLocale.length}/${toolIds.length}`);
  for (const file of seoForLocale) {
    try {
      const mod = await importTs(file); const localized = mod[locale] ?? mod.default ?? Object.values(mod).find((v) => isObject(v));
      if (!localized) issue(locale, 'seo', file, `missing ${locale} export`);
      const enFile = file.replace(/\/[^/]+\.ts$/u, '/en.ts');
      if (localized && existsSync(join(root, enFile))) {
        const em = await importTs(enFile); const source = em.en ?? em.default ?? Object.values(em).find((v) => isObject(v));
        if (source) compare(source, localized, locale, file);
      }
    } catch (e) { issue(locale, 'runtime', file, e instanceof Error ? e.message : String(e)); }
  }

  const seoEntries = [...seoRegistry.matchAll(/Object\.freeze\(\{([^}]*)\}\)/gu)];
  for (let i = 0; i < seoEntries.length; i++) if (!new RegExp(`\\b${locale}:`, 'u').test(seoEntries[i][1])) issue(locale, 'seo', 'SEO registry', `entry ${i + 1} missing ${locale}`);
}

const summary = targets.map((locale) => {
  const mine = errors.filter((e) => e.locale === locale);
  return { locale, missing: mine.filter((e) => e.kind === 'missing').length, fallback: mine.filter((e) => e.kind === 'fallback').length, placeholder: mine.filter((e) => e.kind === 'placeholder').length, html: mine.filter((e) => e.kind === 'html').length, seo: mine.filter((e) => e.kind === 'seo').length, direction: mine.filter((e) => e.kind === 'direction').length, structural: mine.filter((e) => ['structural', 'orphan'].includes(e.kind)).length, runtime: mine.filter((e) => ['runtime', 'registry'].includes(e.kind)).length, eligible: mine.length === 0 };
});
const releaseEligible = targets.length > 0 && targets.every((locale) => summary.find((x) => x.locale === locale)?.eligible) && (!allMode || targets.length === CANONICAL_LOCALES.length);

if (report) {
  console.log('FLIXO LOCALIZATION RELEASE ENGINE');
  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log('LOCALE   MISSING FALLBACK PLACEHOLDER HTML SEO DIRECTION STRUCTURAL RUNTIME ELIGIBLE');
  for (const r of summary) console.log(`${r.locale.padEnd(8)}${String(r.missing).padEnd(8)}${String(r.fallback).padEnd(9)}${String(r.placeholder).padEnd(12)}${String(r.html).padEnd(5)}${String(r.seo).padEnd(4)}${String(r.direction).padEnd(10)}${String(r.structural).padEnd(11)}${String(r.runtime).padEnd(8)}${r.eligible ? 'PASS 🟢' : 'BLOCK 🔴'}`);
  console.log(`\nVERIFIED: ${summary.filter((r) => r.eligible).length}/${summary.length}`);
  console.log(`RELEASE DECISION: ${releaseEligible ? 'APPROVED 🟢' : 'BLOCKED 🔴'}`);
}
if (json) console.log(JSON.stringify({ targets, summary, releaseEligible, errors }, null, 2));
if (strict && !releaseEligible) {
  for (const e of errors.slice(0, 200)) console.error(`- ${e.locale} | ${e.kind} | ${e.area} | ${e.message}`);
  if (errors.length > 200) console.error(`- ... ${errors.length - 200} additional issues; use --json for the full report.`);
  process.exit(1);
}
