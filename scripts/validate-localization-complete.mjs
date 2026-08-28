import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const target = process.env.FLIXO_LOCALE ?? process.argv[2];
if (!target || !CANONICAL_LOCALES.includes(target)) {
  console.error(`Complete localization gate requires one canonical locale: ${CANONICAL_LOCALES.join(', ')}`);
  process.exit(1);
}

const errors = [];
const fail = (message) => errors.push(`${target}: ${message}`);
const read = (path) => readFileSync(join(root, path), 'utf8');
const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
const isObject = (value) => Boolean(value) && typeof value === 'object';
const leaves = (value, path = []) => {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
};
const nonTranslatable = new Set(['locale', 'localeCode', 'languageCode', 'languageTag', 'direction', 'dir']);
const allowedSame = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'AI', 'English', 'Ctrl K', 'Smart Intent']);
const expectedDirection = (locale) => locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
const expectedScript = {
  ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
  ru: /[\u0400-\u04ff]/u,
  zh: /[\u3400-\u9fff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u,
  hi: /[\u0900-\u097f]/u,
  th: /[\u0e00-\u0e7f]/u,
};

function compareValue(en, loc, path, context) {
  if (typeof en !== typeof loc) {
    fail(`${context}: type mismatch at ${path} (${typeof en} vs ${typeof loc})`);
    return;
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(loc)) return;
    if (en.length !== loc.length) fail(`${context}: array length mismatch at ${path} (${en.length} vs ${loc.length})`);
    for (let i = 0; i < Math.min(en.length, loc.length); i += 1) compareValue(en[i], loc[i], `${path}[${i}]`, context);
    return;
  }
  if (isObject(en)) {
    if (!isObject(loc) || Array.isArray(loc)) return;
    const enKeys = Object.keys(en).sort();
    const locKeys = Object.keys(loc).sort();
    for (const key of enKeys) if (!(key in loc)) fail(`${context}: missing key ${path ? `${path}.` : ''}${key}`);
    for (const key of locKeys) if (!(key in en)) fail(`${context}: unexpected key ${path ? `${path}.` : ''}${key}`);
    for (const key of enKeys) if (key in loc) compareValue(en[key], loc[key], path ? `${path}.${key}` : key, context);
    return;
  }
  if (typeof en !== 'string') return;
  const normalized = normalize(loc);
  const leafName = path.split('.').at(-1);
  if (!normalized && !nonTranslatable.has(leafName)) fail(`${context}: empty translation at ${path}`);
  if (target !== 'en' && en === loc && normalized && !allowedSame.has(normalized) && !nonTranslatable.has(leafName)) {
    fail(`${context}: exact English fallback at ${path}: ${JSON.stringify(loc)}`);
  }
  const enPlaceholders = [...en.matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((m) => m[0]);
  const locPlaceholders = [...loc.matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((m) => m[0]);
  if (enPlaceholders.join('|') !== locPlaceholders.join('|')) fail(`${context}: placeholder mismatch at ${path}`);
  const enTags = [...en.matchAll(/<\/?[a-z][^>]*>/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim());
  const locTags = [...loc.matchAll(/<\/?[a-z][^>]*>/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim());
  if (enTags.join('|') !== locTags.join('|')) fail(`${context}: HTML structure mismatch at ${path}`);
}

function compareLocaleObject(english, localized, context) {
  if (!english || !localized) {
    fail(`${context}: missing locale object`);
    return;
  }
  compareValue(english, localized, '', context);
  const script = expectedScript[target];
  if (script) {
    for (const { path, value } of leaves(localized)) {
      if (nonTranslatable.has(path.split('.').at(-1))) continue;
      const text = normalize(value);
      const letters = [...text].filter((char) => /\p{L}/u.test(char));
      if (letters.length < 8 || script.test(text)) continue;
      if (/^(?:FLIXO|QuickFlow|OCR|PDF|AI|English|Ctrl K|Smart Intent)\b/iu.test(text)) continue;
      fail(`${context}: expected ${target} script absent at ${path}: ${JSON.stringify(text)}`);
    }
  }
}

async function importTs(relativePath) {
  return import(pathToFileURL(join(root, relativePath)).href);
}

// Runtime locale registry and metadata.
const config = await importTs('src/lib/i18n/config.ts');
const runtimeLocales = [...(config.LOCALES ?? [])];
if (runtimeLocales.join('|') !== CANONICAL_LOCALES.join('|')) fail(`runtime locale registry drift: ${runtimeLocales.join(', ')}`);
for (const locale of CANONICAL_LOCALES) {
  const metadata = config.LOCALE_METADATA?.[locale];
  if (!metadata) fail(`missing locale metadata for ${locale}`);
  else {
    if (metadata.direction !== expectedDirection(locale)) fail(`direction mismatch for ${locale}: ${metadata.direction}`);
    if (!metadata.languageTag) fail(`missing languageTag for ${locale}`);
  }
}

// Canonical locale dictionaries.
const localeModules = {};
for (const locale of CANONICAL_LOCALES) {
  const path = `src/lib/i18n/locales/${locale}.ts`;
  if (!existsSync(join(root, path))) {
    fail(`missing locale dictionary ${path}`);
    continue;
  }
  const module = await importTs(path);
  const value = module[locale] ?? module.default;
  localeModules[locale] = value;
  if (!value || value.locale !== locale) fail(`locale dictionary identity mismatch in ${path}`);
  if (value.direction !== expectedDirection(locale)) fail(`locale dictionary direction mismatch in ${path}`);
}
if (localeModules.en && localeModules[target] && target !== 'en') compareLocaleObject(localeModules.en, localeModules[target], 'core locale dictionary');

// Automatically cover every locale-bearing data/i18n module under src.
function walk(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', 'coverage'].includes(entry.name)) result.push(...walk(path));
    else if (entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)) result.push(path);
  }
  return result;
}

const candidateFiles = walk(join(root, 'src')).filter((path) => /(?:locale|locales|i18n)/iu.test(path));
for (const absolute of candidateFiles) {
  const relativePath = relative(root, absolute).replaceAll('\\', '/');
  if (/src\/lib\/i18n\/config\.ts$/u.test(relativePath)) continue;
  try {
    const module = await importTs(relativePath);
    for (const [exportName, exported] of Object.entries(module)) {
      if (!isObject(exported) || Array.isArray(exported)) continue;
      if (!CANONICAL_LOCALES.every((locale) => Object.prototype.hasOwnProperty.call(exported, locale))) continue;
      compareLocaleObject(exported.en, exported[target], `${relativePath}:${exportName}/${target}`);
    }
  } catch (error) {
    fail(`unable to load locale-bearing module ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Every tool with an SEO localization surface must have every canonical locale.
const toolsRoot = join(root, 'src/tools');
if (existsSync(toolsRoot)) {
  const tools = readdirSync(toolsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
  for (const tool of tools) {
    const seoDir = join(toolsRoot, tool.name, 'seo');
    if (!existsSync(seoDir)) continue;
    const seoFiles = new Set(readdirSync(seoDir).filter((file) => /^([a-z]{2})\.ts$/u.test(file)).map((file) => file.slice(0, -3)));
    for (const locale of CANONICAL_LOCALES) if (!seoFiles.has(locale)) fail(`${tool.name}/seo missing ${locale}.ts`);
    if (!seoFiles.has('en') || !seoFiles.has(target)) continue;
    try {
      const enModule = await importTs(`src/tools/${tool.name}/seo/en.ts`);
      const locModule = await importTs(`src/tools/${tool.name}/seo/${target}.ts`);
      const pick = (module, locale) => module[locale] ?? module.default ?? Object.values(module).find((value) => isObject(value) && !Array.isArray(value));
      compareLocaleObject(pick(enModule, 'en'), pick(locModule, target), `${tool.name}/seo/${target}`);
    } catch (error) {
      fail(`${tool.name}/seo/${target}: module load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// User-facing UI literals must not bypass localization. This is intentionally strict.
const uiRoots = ['src/routes', 'src/components', 'src/pages', 'src/layouts', 'src/tools'];
const attrPattern = /\b(?:aria-label|aria-description|placeholder|title|alt)\s*=\s*["']([^"']{2,})["']/gu;
const jsxTextPattern = />\s*([A-Za-z][A-Za-z0-9 ,.'’!?&:/()\-]{3,})\s*</gu;
const technicalOnly = /^(?:FLIXO|QuickFlow|OCR|PDF|AI|SVG|PNG|JPG|JPEG|WEBP|MP3|MP4|Ctrl K|HTTP|HTTPS)$/iu;
for (const uiRoot of uiRoots) {
  const dir = join(root, uiRoot);
  if (!existsSync(dir)) continue;
  for (const absolute of walk(dir)) {
    const relativePath = relative(root, absolute).replaceAll('\\', '/');
    if (/(?:locales?|i18n|test|spec|\.stories\.)/iu.test(relativePath)) continue;
    const source = readFileSync(absolute, 'utf8');
    for (const match of source.matchAll(attrPattern)) {
      const value = normalize(match[1]);
      if (!/[A-Za-z]{2}/u.test(value) || technicalOnly.test(value)) continue;
      fail(`hard-coded user-facing attribute in ${relativePath}: ${JSON.stringify(value)}`);
    }
    for (const match of source.matchAll(jsxTextPattern)) {
      const value = normalize(match[1]);
      if (value.length < 4 || !/[A-Za-z]{2}/u.test(value) || technicalOnly.test(value)) continue;
      if (/^(?:[A-Z][A-Za-z0-9_-]*|[A-Z]{2,})$/u.test(value)) continue;
      fail(`hard-coded JSX text in ${relativePath}: ${JSON.stringify(value)}`);
    }
  }
}

if (target !== 'en') {
  const sourceFiles = walk(join(root, 'src')).filter((path) => /\.(?:ts|tsx)$/u.test(path));
  const fallbackPatterns = [
    /fallback\s*[:=]\s*['"]?en\b/iu,
    /defaultLocale\s*[:=]\s*['"]en['"]/u,
    /locale\s*\?\?\s*['"]en['"]/u,
  ];
  for (const absolute of sourceFiles) {
    const relativePath = relative(root, absolute).replaceAll('\\', '/');
    if (/(?:locales?|i18n\/config|test|spec)/iu.test(relativePath)) continue;
    const source = readFileSync(absolute, 'utf8');
    for (const pattern of fallbackPatterns) if (pattern.test(source)) fail(`English fallback policy marker found in ${relativePath}: ${pattern}`);
  }
}

if (errors.length) {
  console.error(`COMPLETE LOCALIZATION GATE FAILED — ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`COMPLETE LOCALIZATION GATE PASSED — ${target}; registry, locale dictionaries, all locale-bearing modules, tool SEO surfaces, translation contracts, fallback policy, placeholder/HTML integrity, script/direction integrity, and UI localization boundaries are clean.`);
