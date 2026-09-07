import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANONICAL_LOCALES } from './validation-contracts.mjs';

const ROOT = process.cwd();
const LOCALE_DIR = join(ROOT, 'src/lib/i18n/locales');
const SOURCE_ROOT = join(ROOT, 'src');

const sourceFiles = [];
function collectSourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full);
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) sourceFiles.push(full);
  }
}
collectSourceFiles(SOURCE_ROOT);

async function loadLocale(locale) {
  const moduleUrl = pathToFileURL(join(LOCALE_DIR, `${locale}.ts`)).href;
  const module = await import(`${moduleUrl}?parity=${locale}`);
  const dictionary = module[locale];
  if (!dictionary || typeof dictionary !== 'object') {
    throw new Error(`Locale ${locale} does not export a dictionary named ${locale}.`);
  }
  return dictionary;
}

function isLocaleSensitiveProductionSource(source) {
  if (!/\.tsx?$/u.test(source)) return false;
  if (source.includes(join('src', 'lib', 'i18n', 'locales'))) return false;
  const text = readFileSync(source, 'utf8');
  return /locale|LOCALES|getTranslationBundle|loadTranslationDictionary|localized|hreflang|direction/u.test(text);
}

function literalPresent(sourceText, value) {
  return sourceText.includes(`'${value}'`) || sourceText.includes(`"${value}"`) || sourceText.includes(`\`${value}\``);
}

const errors = [];
let base;
try {
  base = await loadLocale('en');
} catch (error) {
  errors.push(`Failed to load base English dictionary: ${error instanceof Error ? error.message : String(error)}`);
}

if (base) {
  const baseKeys = Object.keys(base).sort();
  const semanticEnglishKeys = baseKeys.filter((key) => !['locale', 'languageTag', 'direction', 'siteName'].includes(key));

  for (const locale of CANONICAL_LOCALES) {
    let dictionary;
    try {
      dictionary = await loadLocale(locale);
    } catch (error) {
      errors.push(`Failed to load locale ${locale}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const localeKeys = Object.keys(dictionary).sort();
    const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(dictionary, key));
    const extra = localeKeys.filter((key) => !Object.prototype.hasOwnProperty.call(base, key));
    if (missing.length) errors.push(`${locale}: missing translation keys: ${missing.join(', ')}`);
    if (extra.length) errors.push(`${locale}: extra translation keys not present in en: ${extra.join(', ')}`);

    for (const key of baseKeys) {
      if (!Object.prototype.hasOwnProperty.call(dictionary, key)) continue;
      const expected = base[key];
      const actual = dictionary[key];
      if (Array.isArray(expected) !== Array.isArray(actual)) {
        errors.push(`${locale}.${key}: value type differs from en`);
        continue;
      }
      if (typeof expected === 'string' && typeof actual === 'string' && locale !== 'en' && semanticEnglishKeys.includes(key) && actual === expected) {
        errors.push(`${locale}.${key}: exact English value equals the base dictionary; silent fallback is forbidden`);
      }
    }
  }

  for (const source of sourceFiles) {
    if (!isLocaleSensitiveProductionSource(source)) continue;
    const sourceText = readFileSync(source, 'utf8');
    for (const key of semanticEnglishKeys) {
      const value = base[key];
      if (typeof value !== 'string' || value.length < 4) continue;
      if (literalPresent(sourceText, value)) {
        errors.push(`${relative(ROOT, source)}: raw English production string matches base translation key ${key}; use the active locale dictionary instead`);
      }
    }
  }
}

if (errors.length) {
  console.error(`i18n parity validation FAILED with ${errors.length} violation(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n parity validation PASS: ${CANONICAL_LOCALES.length} non-base locales match the English key contract and no localized production source embeds protected English dictionary values.`);
