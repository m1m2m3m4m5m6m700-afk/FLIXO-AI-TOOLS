import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = join(ROOT, 'src/lib/i18n/config.ts');
const LOCALES_DIR = join(ROOT, 'src/lib/i18n/locales');
const CANONICAL_LOCALE_PATTERN = /export const LOCALES = \[([\s\S]*?)\] as const/;
const LEGACY_LOCALE_TOKENS = /(?:^|[^a-z])(?:ms|uk)(?:$|[^a-z])/i;
const LEGACY_LOCALE_PATH = /(?:^|[\\/])(?:ms|uk)(?:\.(?:ts|tsx|js|jsx|mjs|cjs))$/i;
const LEGACY_ADAPTER_PATH = /(?:^|[\\/])[^\\/]*(?:ms-uk|msuk)[^\\/]*\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const SOURCE_ROOTS = ['src', 'scripts', 'tests', '.github'];

function fail(message) {
  console.error(`Canonical locale surface validation failed: ${message}`);
  process.exit(1);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

const configSource = read(CONFIG_PATH);
const localeMatch = configSource.match(CANONICAL_LOCALE_PATTERN);
if (!localeMatch) fail('src/lib/i18n/config.ts does not expose the canonical LOCALES registry.');

const canonicalLocales = localeMatch[1].match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];
if (canonicalLocales.length !== 20) fail(`canonical locale count is ${canonicalLocales.length}; expected 20.`);
if (new Set(canonicalLocales).size !== canonicalLocales.length) fail('canonical locale registry contains duplicates.');

if (!existsSync(LOCALES_DIR)) fail('src/lib/i18n/locales directory is missing.');
const localeFiles = readdirSync(LOCALES_DIR).filter((name) => name.endsWith('.ts')).sort();
const expectedFiles = canonicalLocales.map((locale) => `${locale}.ts`).sort();
const missingFiles = expectedFiles.filter((name) => !localeFiles.includes(name));
const unexpectedFiles = localeFiles.filter((name) => !expectedFiles.includes(name));
if (missingFiles.length) fail(`missing canonical locale files: ${missingFiles.join(', ')}`);
if (unexpectedFiles.length) fail(`unexpected locale files: ${unexpectedFiles.join(', ')}`);

const loaderSource = read(join(ROOT, 'src/lib/i18n/loader.ts'));
for (const locale of canonicalLocales) {
  const entry = new RegExp(`\\b${locale}:\\s*async\\s*\\(\\)`).test(loaderSource);
  if (!entry) fail(`locale loader entry is missing: ${locale}`);
}
for (const legacy of ['ms', 'uk']) {
  if (new RegExp(`\\b${legacy}:\\s*async\\s*\\(\\)`).test(loaderSource)) fail(`legacy locale loader remains: ${legacy}`);
}

const legacyHits = [];
function walk(directory) {
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(name.name)) continue;
    const absolute = join(directory, name.name);
    if (name.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs|json|yml|yaml)$/i.test(name.name)) continue;
    const normalized = relative(ROOT, absolute).replaceAll('\\', '/');
    if (normalized.startsWith('artifacts/')) continue;
    if (LEGACY_LOCALE_PATH.test(normalized) || LEGACY_ADAPTER_PATH.test(normalized)) {
      legacyHits.push(`${normalized}:legacy-path`);
      continue;
    }
    const source = read(absolute);
    if (normalized.startsWith('src/lib/i18n/') || normalized === 'src/data/tool-ui-i18n.ts' || normalized === 'src/components/ads/ElegantAdSlot.tsx' || normalized === 'src/components/technical-tool-shell.tsx') {
      const lines = source.split(/\r?\n/u);
      lines.forEach((line, index) => {
        if (/import[^\n]*(?:ms-uk|locales\/(?:ms|uk))(?:['"]|[\/])/iu.test(line) || /\b(?:ms|uk)\s*:\s*(?:async\s*)?\(/u.test(line) || /Record<(?:CanonicalLocale|Locale)[^>]*>[^\n]*\b(?:ms|uk)\s*:/u.test(line)) {
          legacyHits.push(`${normalized}:${index + 1}:${line.trim()}`);
        }
      });
    }
  }
}

for (const root of SOURCE_ROOTS) {
  const absolute = join(ROOT, root);
  if (existsSync(absolute)) walk(absolute);
}

if (legacyHits.length) fail(`legacy locale surface detected:\n${legacyHits.join('\n')}`);

console.log(`Canonical locale surface: PASS — ${canonicalLocales.length} locales, exact locale-file parity, loader parity, and no ms/uk legacy surface.`);
