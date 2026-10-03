import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "lib", "i18n", "locales");
const canonical = [
  "ar",
  "en",
  "es",
  "fr",
  "de",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl",
  "pl",
  "pt",
  "ru",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
];
const files = new Set(readdirSync(root));
const missingFiles = canonical.filter((locale) => !files.has(`${locale}.ts`));

if (missingFiles.length) {
  throw new Error(`Missing canonical locale files: ${missingFiles.join(", ")}`);
}

const extras = [...files]
  .filter((file) => /^([a-z]{2})\.ts$/.test(file) && !canonical.includes(file.slice(0, -3)))
  .sort();

const loadLocale = async (locale) => {
  const module = await import(`../src/lib/i18n/locales/${locale}.ts`);
  return module[locale];
};

const flatten = (value, prefix = "") => {
  const keys = [];
  if (!value || typeof value !== "object") return keys;

  for (const [key, child] of Object.entries(value)) {
    if (key === "locale" || key === "languageTag" || key === "direction") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      keys.push(...flatten(child, path));
    } else {
      keys.push(path);
    }
  }

  return keys;
};

const english = await loadLocale("en");
const expected = new Set(flatten(english));
const gaps = [];

for (const locale of canonical) {
  const actual = new Set(flatten(await loadLocale(locale)));
  const missingKeys = [...expected].filter((key) => !actual.has(key));
  if (missingKeys.length) gaps.push({ locale, missingKeys });
}

if (gaps.length) {
  console.error(JSON.stringify({ gaps }, null, 2));
  throw new Error("Canonical locale dictionaries are incomplete");
}

console.log(`I18N_CANONICAL_LOCALES_OK=${canonical.length}`);
console.log(`I18N_KEY_COVERAGE_OK=${canonical.length}`);
console.log(`I18N_EXTRA_DICTIONARIES=${extras.length ? extras.join(", ") : "none"}`);
