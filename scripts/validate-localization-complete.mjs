import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

/*
 * FLIXO Localization Release Engine
 *
 * Release semantics are deliberately conjunctive:
 * eligible(locale) = MachineGate && every required metric == target.
 * No arithmetic average can mask a failed dimension.
 *
 * The engine is intentionally kept as one executable entry point in this PR
 * so CI can adopt the stronger contract without creating a second test stack.
 * It supports per-locale CI mode and complete-matrix reporting mode.
 */
const root = process.cwd();
const args = new Set(process.argv.slice(2));
const requested = process.env.FLIXO_LOCALE ?? process.argv.slice(2).find((x) => CANONICAL_LOCALES.includes(x));
const allMode = !requested;
const strict = args.has('--strict') || allMode;
const report = args.has('--report');
const json = args.has('--json');
const targets = requested ? [requested] : CANONICAL_LOCALES;
if (!targets.every((locale) => CANONICAL_LOCALES.includes(locale))) {
  console.error(`Unknown locale. Canonical locales: ${CANONICAL_LOCALES.join(', ')}`);
  process.exit(1);
}

const expectedDirection = (locale) => locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
const nonTranslatable = new Set(['locale', 'localeCode', 'languageCode', 'languageTag', 'direction', 'dir']);
const allowedSame = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'AI', 'English', 'Ctrl K', 'Smart Intent']);
const technicalOnly = /^(?:FLIXO|QuickFlow|OCR|PDF|AI|SVG|PNG|JPG|JPEG|WEBP|MP3|MP4|Ctrl K|HTTP|HTTPS|URL|API|JSON)$/iu;
const scriptRules = {
  ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ru: /[\u0400-\u04ff]/u,
  zh: /[\u3400-\u9fff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u,
  hi: /[\u0900-\u097f]/u,
  th: /[\u0e00-\u0e7f]/u,
};

const normalize = (value) => String(value).replace(/\s+/gu, ' ').trim();
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const read = (path) => readFileSync(join(root, path), 'utf8');
const importTs = async (path) => import(pathToFileURL(join(root, path)).href);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(path));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) result.push(path);
  }
  return result;
}

function leaves(value, path = []) {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
}

function compareValues(source, localized, locale, context, issues) {
  const visit = (a, b, path) => {
    if (typeof a !== typeof b) {
      issues.push({ kind: 'missing', context, message: `type mismatch at ${path}` });
      return;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return;
      if (a.length !== b.length) issues.push({ kind: 'missing', context, message: `array length mismatch at ${path}` });
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) visit(a[i], b[i], `${path}[${i}]`);
      return;
    }
    if (isObject(a)) {
      if (!isObject(b)) return;
      const sourceKeys = Object.keys(a).sort();
      const targetKeys = Object.keys(b).sort();
      for (const key of sourceKeys) if (!(key in b)) issues.push({ kind: 'missing', context, message: `missing key ${path ? `${path}.` : ''}${key}` });
      for (const key of targetKeys) if (!(key in a)) issues.push({ kind: 'orphan', context, message: `unexpected key ${path ? `${path}.` : ''}${key}` });
      for (const key of sourceKeys) if (key in b) visit(a[key], b[key], path ? `${path}.${key}` : key);
      return;
    }
    if (typeof a !== 'string') return;
    const leaf = path.split('.').at(-1) ?? path;
    const value = normalize(b);
    if (!value && !nonTranslatable.has(leaf)) issues.push({ kind: 'missing', context, message: `empty translation at ${path}` });
    if (locale !== 'en' && a === b && value && !allowedSame.has(value) && !nonTranslatable.has(leaf)) issues.push({ kind: 'fallback', context, message: `exact English fallback at ${path}` });
    const placeholders = (x) => [...x.matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((m) => m[0]).join('|');
    if (placeholders(a) !== placeholders(b)) issues.push({ kind: 'placeholder', context, message: `placeholder mismatch at ${path}` });
    const tags = (x) => [...x.matchAll(/<\/?[a-z][^>]*>/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim()).join('|');
    if (tags(a) !== tags(b)) issues.push({ kind: 'html', context, message: `HTML structure mismatch at ${path}` });
  };
  visit(source, localized, '');
}

function addIssue(result, kind, context, message) {
  result.issues.push({ kind, context, message });
}

function metric(result, name, target, value) {
  result.metrics[name] = { target, value, pass: value === target };
}

async function inspectLocale(locale, shared) {
  const result = { locale, issues: [], metrics: {}, machineGate: false, eligible: false };
  const config = shared.config;
  const metadata = config.LOCALE_METADATA?.[locale];
  if (!metadata) addIssue(result, 'direction', 'runtime', `missing locale metadata for ${locale}`);
  else {
    if (metadata.direction !== expectedDirection(locale)) addIssue(result, 'direction', 'runtime', `expected direction ${expectedDirection(locale)}, found ${metadata.direction}`);
    if (!metadata.languageTag) addIssue(result, 'direction', 'runtime', 'missing languageTag');
  }

  const dictionaryPath = `src/lib/i18n/locales/${locale}.ts`;
  let localized;
  if (!existsSync(join(root, dictionaryPath))) addIssue(result, 'missing', 'dictionary', `missing ${dictionaryPath}`);
  else {
    const module = await importTs(dictionaryPath);
    localized = module[locale] ?? module.default;
    if (!localized || localized.locale !== locale) addIssue(result, 'missing', 'dictionary', 'locale identity mismatch');
    if (localized?.direction !== expectedDirection(locale)) addIssue(result, 'direction', 'dictionary', `expected ${expectedDirection(locale)}, found ${localized?.direction ?? '<missing>'}`);
    if (shared.english && localized) compareValues(shared.english, localized, locale, 'core dictionary', result.issues);
    const script = scriptRules[locale];
    if (script && localized) {
      for (const leaf of leaves(localized)) {
        const text = normalize(leaf.value);
        const letters = [...text].filter((char) => /\p{L}/u.test(char));
        if (letters.length < 8 || script.test(text) || /^(?:FLIXO|QuickFlow|OCR|PDF|AI|English|Ctrl K|Smart Intent)\b/iu.test(text)) continue;
        if (!nonTranslatable.has(leaf.path.split('.').at(-1) ?? '')) addIssue(result, 'fallback', 'script', `expected ${locale} script absent at ${leaf.path}`);
      }
    }
  }

  // Every locale-bearing module under src is compared to its English sibling.
  const localeFiles = walk(join(root, 'src')).filter((path) => /(?:locale|locales|i18n)/iu.test(path));
  let moduleCount = 0;
  for (const absolute of localeFiles) {
    const rel = relative(root, absolute).replaceAll('\\', '/');
    if (/src\/lib\/i18n\/config\.ts$/u.test(rel)) continue;
    try {
      const module = await importTs(rel);
      for (const [exportName, exported] of Object.entries(module)) {
        if (!isObject(exported) || !CANONICAL_LOCALES.every((l) => Object.prototype.hasOwnProperty.call(exported, l))) continue;
        moduleCount += 1;
        compareValues(exported.en, exported[locale], locale, `${rel}:${exportName}/${locale}`, result.issues);
      }
    } catch (error) {
      addIssue(result, 'runtime', rel, error instanceof Error ? error.message : String(error));
    }
  }

  // Tool SEO is a hard coverage surface: every discovered SEO directory must expose all canonical locales.
  const toolsRoot = join(root, 'src/tools');
  let seoTools = 0; let seoExpected = 0; let seoCovered = 0;
  if (existsSync(toolsRoot)) {
    const tools = readdirSync(toolsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
    for (const tool of tools) {
      const seoDir = join(toolsRoot, tool.name, 'seo');
      if (!existsSync(seoDir)) continue;
      seoTools += 1; seoExpected += CANONICAL_LOCALES.length;
      const files = new Set(readdirSync(seoDir).filter((file) => /^[a-z]{2}\.ts$/u.test(file)).map((file) => file.slice(0, -3)));
      for (const l of CANONICAL_LOCALES) if (files.has(l)) seoCovered += 1; else addIssue(result, 'seo', `${tool.name}/seo`, `missing ${l}.ts`);
      if (files.has('en') && files.has(locale)) {
        try {
          const enModule = await importTs(`src/tools/${tool.name}/seo/en.ts`);
          const locModule = await importTs(`src/tools/${tool.name}/seo/${locale}.ts`);
          const pick = (m) => m[locale] ?? m.default ?? Object.values(m).find((v) => isObject(v));
          compareValues(pick(enModule), pick(locModule), locale, `${tool.name}/seo/${locale}`, result.issues);
        } catch (error) { addIssue(result, 'seo', `${tool.name}/seo/${locale}`, error instanceof Error ? error.message : String(error)); }
      }
    }
  }

  // TypeScript AST scan of all user-facing route/component/layout/tool surfaces.
  let uiFiles = 0; let routeFiles = 0;
  const uiRoots = ['src/routes', 'src/components', 'src/pages', 'src/layouts', 'src/tools'];
  const attrs = new Set(['aria-label', 'aria-description', 'aria-labelledby', 'placeholder', 'title', 'alt']);
  for (const rootDir of uiRoots) {
    const files = walk(join(root, rootDir));
    for (const absolute of files) {
      uiFiles += 1;
      if (rootDir === 'src/routes' && absolute.endsWith('.tsx') && !absolute.endsWith('__root.tsx')) routeFiles += 1;
      if (locale === 'en') continue;
      const source = readFileSync(absolute, 'utf8');
      const sf = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, absolute.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const rel = relative(root, absolute).replaceAll('\\', '/');
      const visit = (node) => {
        if (ts.isJsxText(node)) {
          const value = normalize(node.getText(sf));
          if (value.length >= 4 && /[A-Za-z]{2}/u.test(value) && !technicalOnly.test(value)) addIssue(result, 'hardcoded', rel, `hard-coded JSX text: ${JSON.stringify(value)}`);
        }
        if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && attrs.has(node.name.text)) {
          const value = normalize(node.initializer.text);
          if (value && /[A-Za-z]{2}/u.test(value) && !technicalOnly.test(value)) addIssue(result, 'a11y', rel, `hard-coded ${node.name.text}: ${JSON.stringify(value)}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }

  // Static fallback policy scan across the full source tree.
  let fallbackMarkers = 0;
  if (locale !== 'en') {
    const patterns = [/fallback\s*[:=]\s*['"]?en\b/iu, /defaultLocale\s*[:=]\s*['"]en['"]/u, /locale\s*\?\?\s*['"]en['"]/u];
    for (const absolute of walk(join(root, 'src'))) {
      const rel = relative(root, absolute).replaceAll('\\', '/');
      if (/(?:locales?|i18n\/config|test|spec)/iu.test(rel)) continue;
      const source = readFileSync(absolute, 'utf8');
      for (const pattern of patterns) if (pattern.test(source)) { fallbackMarkers += 1; addIssue(result, 'runtime', rel, `English fallback policy marker: ${pattern}`); }
    }
  }

  const count = (kind) => result.issues.filter((issue) => issue.kind === kind).length;
  const hardcoded = count('hardcoded');
  const a11y = count('a11y');
  const fallbacks = count('fallback') + fallbackMarkers;
  const structural = count('missing') + count('orphan') + count('placeholder') + count('html') + count('runtime') + count('direction');

  metric(result, 'ROUTES', routeFiles, routeFiles - result.issues.filter((i) => i.kind === 'hardcoded' && i.context.startsWith('src/routes/')).length);
  metric(result, 'UI', uiFiles, uiFiles - hardcoded);
  metric(result, 'SEO', seoExpected, seoCovered);
  metric(result, 'A11Y', 0, a11y);
  metric(result, 'FALLBACKS', 0, fallbacks);
  metric(result, 'STRUCTURAL', 0, structural);
  metric(result, 'MODULES', moduleCount, moduleCount - result.issues.filter((i) => i.context.includes('i18n') && ['missing', 'orphan', 'placeholder', 'html'].includes(i.kind)).length);
  result.machineGate = Object.values(result.metrics).every((m) => m.pass);
  result.eligible = result.machineGate;
  return result;
}

const config = await importTs('src/lib/i18n/config.ts');
const runtimeLocales = [...(config.LOCALES ?? [])];
const shared = { config, english: null };
if (runtimeLocales.join('|') !== CANONICAL_LOCALES.join('|')) console.error(`Locale registry drift: ${runtimeLocales.join(', ')}`);
const enPath = 'src/lib/i18n/locales/en.ts';
if (existsSync(join(root, enPath))) {
  const enModule = await importTs(enPath);
  shared.english = enModule.en ?? enModule.default;
}

const results = [];
for (const locale of targets) results.push(await inspectLocale(locale, shared));

const allEligible = results.length === CANONICAL_LOCALES.length && results.every((r) => r.eligible) && runtimeLocales.join('|') === CANONICAL_LOCALES.join('|');
const percentage = (value, target) => target === 0 ? (value === 0 ? 100 : 0) : Math.round((value / target) * 100);

if (report) {
  console.log('FLIXO LOCALIZATION RELEASE ENGINE');
  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log('LOCALE   ROUTES     UI        SEO       A11Y      FALLBACKS  ELIGIBLE');
  for (const r of results) {
    const row = (name, fallback = '') => `${String(name).padEnd(8)}${fallback}`;
    const routes = r.metrics.ROUTES; const ui = r.metrics.UI; const seo = r.metrics.SEO; const a11y = r.metrics.A11Y;
    console.log(`${row(r.locale)}${String(`${percentage(routes.value, routes.target)}%`).padEnd(10)}${String(`${percentage(ui.value, ui.target)}%`).padEnd(10)}${String(`${percentage(seo.value, seo.target)}%`).padEnd(10)}${String(`${a11y.value}`).padEnd(10)}${String(r.metrics.FALLBACKS.value).padEnd(11)}${r.eligible ? 'PASS 🟢' : 'BLOCK 🔴'}`);
  }
  console.log(`\nALL LOCALES: ${results.filter((r) => r.eligible).length}/${CANONICAL_LOCALES.length}`);
  console.log(`ENGINEERING SCORE: ${allEligible ? '100% ALL LOCALES' : 'BLOCKED — AND gate not satisfied'}`);
  console.log(`RELEASE DECISION: ${allEligible ? 'APPROVED 🟢' : 'BLOCKED 🔴'}`);
}

if (json) console.log(JSON.stringify({ canonicalLocales: CANONICAL_LOCALES, results, releaseEligible: allEligible }, null, 2));

if (!report && !json) {
  for (const r of results) {
    console.log(`Localization ${r.locale}: ${r.eligible ? 'PASS' : 'FAIL'} — ${r.issues.length} issue(s)`);
    for (const issue of r.issues.slice(0, 50)) console.log(`  [${issue.kind}] ${issue.context}: ${issue.message}`);
    if (r.issues.length > 50) console.log(`  ... ${r.issues.length - 50} additional issue(s) omitted; use --report --json for the full report.`);
  }
}

if (strict && !allEligible) process.exit(1);
