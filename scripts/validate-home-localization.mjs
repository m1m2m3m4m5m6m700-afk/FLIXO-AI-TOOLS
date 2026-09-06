import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const source = readFileSync('src/data/home-locales.ts', 'utf8');
const overrides = readFileSync('src/lib/i18n/locale-quality-overrides.ts', 'utf8');
const homeLoader = readFileSync('src/lib/i18n/home-loader.ts', 'utf8');
const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
const translations = readFileSync('src/lib/i18n/translations.ts', 'utf8');

const expected = config.match(/export\s+const\s+LOCALES\s*=\s*\[([\s\S]*?)\]\s+as\s+const/)?.[1]
  ?.match(/'([a-z]{2})'/g)?.map((v) => v.slice(1, -1)) ?? [];
const canonical = new Set(expected);
const deprecated = new Set(['zh', 'ur']);

if (expected.length !== 20 || expected.length !== canonical.size) {
  console.error(`LOCALES must contain exactly 20 unique canonical locales; got ${expected.length}.`);
  process.exit(1);
}
if ([...deprecated].some((locale) => canonical.has(locale))) {
  console.error('Deprecated home locales must never be canonical: zh/ur.');
  process.exit(1);
}

const localeEntry = (text, locale, kind) => {
  const marker = `  ${locale}: ${kind}({`;
  const start = text.indexOf(marker);
  if (start < 0) return '';
  const next = text.slice(start + marker.length).search(/^\x20{2}[a-z]{2}: (?:copy|Object\.freeze)\(\{/m);
  return text.slice(start, next < 0 ? text.length : start + marker.length + next);
};
const primary = expected.filter((locale) => source.includes(`  ${locale}: copy({`));
const reviewed = [...overrides.matchAll(/^\x20{2}([a-z]{2}): Object\.freeze\(\{/gm)].map((m) => m[1]);

const unsupportedPrimary = [...new Set(primary.filter((locale) => !canonical.has(locale) && !deprecated.has(locale)))];
const unsupportedOverrides = [...new Set(reviewed.filter((locale) => !canonical.has(locale)))];
if (unsupportedPrimary.length || unsupportedOverrides.length) {
  console.error(`Unsupported Home locales. Primary: ${unsupportedPrimary.join(', ') || 'none'}; overrides: ${unsupportedOverrides.join(', ') || 'none'}`);
  process.exit(1);
}

const missingCanonical = expected.filter((locale) => !primary.includes(locale) && !reviewed.includes(locale));
if (missingCanonical.length) {
  console.error(`Missing canonical Home locales: ${missingCanonical.join(', ')}`);
  process.exit(1);
}

const required = ['language','dir','nav','badge','eyebrow','heroTitle','heroLead','describe','searchLabel','searchPlaceholder','smartPalette','suggested','openDirectly','popular','trust','quickDrop','quickDropTitle','quickDropLead','dropChoose','dropSupport','suggestedTool','openTool','toolbox','toolboxTitle','ready','empty','builtForFocus','finalTitle','finalLead','trySmart','all','browserMeta','ariaHome','ariaPrimary','ariaFindTool','ariaTrust','ariaCategories','quickTags'];
const allowedOverrideKeys = new Set(required);

const objectKeys = (block) => {
  const keys = new Set();
  const open = block.indexOf('{');
  if (open < 0) return keys;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < block.length; i += 1) {
    const ch = block[i];
    const next = block[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }
    if (depth !== 1 || !/[A-Za-z_$]/.test(ch)) continue;

    let end = i + 1;
    while (/[A-Za-z0-9_$]/.test(block[end] ?? '')) end += 1;
    let cursor = end;
    while (/\s/.test(block[cursor] ?? '')) cursor += 1;
    if (block[cursor] === ':') keys.add(block.slice(i, end));
    i = end - 1;
  }

  return keys;
};

for (const locale of expected) {
  const primaryBlock = localeEntry(source, locale, 'copy');
  const overrideBlock = localeEntry(overrides, locale, 'Object.freeze');
  const primaryKeys = objectKeys(primaryBlock);
  const overrideKeys = objectKeys(overrideBlock);
  const missingKeys = required.filter((key) => !primaryKeys.has(key) && !overrideKeys.has(key));
  if (missingKeys.length) {
    console.error(`Locale ${locale} is structurally incomplete; missing keys across primary + reviewed overlay: ${missingKeys.join(', ')}`);
    process.exit(1);
  }
  const unknownOverrideKeys = [...overrideKeys].filter((key) => !allowedOverrideKeys.has(key));
  if (unknownOverrideKeys.length) {
    console.error(`Locale ${locale} has unknown Home override keys: ${unknownOverrideKeys.join(', ')}`);
    process.exit(1);
  }
  if (primaryBlock && overrideBlock && overrideKeys.size >= required.length && required.every((key) => overrideKeys.has(key))) {
    console.error(`Locale ${locale} override shadows the full Home catalog; reviewed overrides must remain partial overlays.`);
    process.exit(1);
  }
}

if (!/isLocale\(locale\)/.test(homeLoader) || !/return cached/.test(homeLoader)) {
  console.error('Home loader must enforce canonical locale validation before serving cached Home copy.');
  process.exit(1);
}
if (!source.includes('HOME_I18N')) {
  console.error('home-locales.ts must remain the Home catalog source.');
  process.exit(1);
}
const runtimeHomeImport = /(^|\n)\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*home-locales['"]/m;
if (runtimeHomeImport.test(homePage)) {
  console.error('HomePage must not runtime-import home-locales.ts; use the lazy home loader.');
  process.exit(1);
}
if (/(?:import|export)\s+(?:[^'";]+?from\s+)?['"].*\/locales\/[^'"]+['"]/.test(translations)) {
  console.error('translations.ts must not statically import locale modules.');
  process.exit(1);
}
console.log(`Home localization coverage passed: ${expected.length} canonical locales with reviewed partial overlays; deprecated legacy entries remain noncanonical: ${[...deprecated].join(', ')}.`);
console.log('Home lazy boundary contract passed.');
