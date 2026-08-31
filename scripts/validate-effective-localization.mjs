import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const issue = [];
const norm = (v) => String(v ?? '').replace(/\s+/gu, ' ').trim();
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const placeholders = (v) => [...String(v ?? '').matchAll(/\{\{[^}]+\}\}|\{[^}]+\}/gu)].map((m) => m[0]).sort().join('|');
const tags = (v) => [...String(v ?? '').matchAll(/<\/?[a-z][^>]*>/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim()).join('|');
const leaves = (v, path = []) => {
  if (typeof v === 'string') return [{ path: path.join('.'), value: v }];
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, [...path, String(i)]));
  if (!isObject(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, k]));
};
const importTs = async (file) => import(pathToFileURL(join(root, file)).href);
function compare(reference, localized, locale, area, path = '') {
  if (typeof reference !== typeof localized) { issue.push(`${locale} | structural | ${area} | type mismatch at ${path}`); return; }
  if (Array.isArray(reference)) {
    if (!Array.isArray(localized) || reference.length !== localized.length) issue.push(`${locale} | structural | ${area} | array mismatch at ${path}`);
    for (let i = 0; i < Math.min(reference.length, localized.length); i += 1) compare(reference[i], localized[i], locale, area, `${path}[${i}]`);
    return;
  }
  if (isObject(reference)) {
    if (!isObject(localized)) { issue.push(`${locale} | structural | ${area} | object mismatch at ${path}`); return; }
    for (const key of Object.keys(reference)) if (!(key in localized)) issue.push(`${locale} | missing | ${area} | missing ${path ? `${path}.` : ''}${key}`);
    for (const key of Object.keys(localized)) if (!(key in reference)) issue.push(`${locale} | orphan | ${area} | orphan ${path ? `${path}.` : ''}${key}`);
    for (const key of Object.keys(reference)) if (key in localized) compare(reference[key], localized[key], locale, area, path ? `${path}.${key}` : key);
    return;
  }
  if (typeof reference !== 'string') return;
  if (!norm(localized)) issue.push(`${locale} | missing | ${area} | empty ${path}`);
  if (placeholders(reference) !== placeholders(localized)) issue.push(`${locale} | placeholder | ${area} | placeholder mismatch at ${path}`);
  if (tags(reference) !== tags(localized)) issue.push(`${locale} | html | ${area} | HTML mismatch at ${path}`);
}

const config = await importTs('src/lib/i18n/config.ts');
const registryLocales = [...(config.LOCALES ?? [])];
if (registryLocales.length !== CANONICAL_LOCALES.length || registryLocales.some((v, i) => v !== CANONICAL_LOCALES[i])) {
  issue.push(`runtime | registry | runtime | locale registry drift: ${registryLocales.join(', ')}`);
}
const { en: EN_DICTIONARY } = await importTs('src/lib/i18n/locales/en.ts');
const localeQuality = await importTs('src/lib/i18n/locale-quality-overrides.ts');
const homeData = await importTs('src/data/home-locales.ts');
const quickData = await importTs('src/data/quickflow-locales.ts');
const toolUi = await importTs('src/data/tool-ui-i18n.ts');
const { TOOLS_REGISTRY } = await importTs('src/config/tools.ts');
const { getAuthoritativeToolSeoName } = await importTs('src/config/tool-seo-name-resolver.ts');

const effectiveHome = (locale) => ({ ...(homeData.getHomeCopy(locale) ?? {}), ...(localeQuality.HOME_COPY_OVERRIDES[locale] ?? {}) });
const effectiveQuick = (locale) => ({ ...(quickData.QUICKFLOW_LOCALES[locale] ?? {}), ...(localeQuality.QUICKFLOW_COPY_OVERRIDES[locale] ?? {}) });
const requiredHome = Object.keys(homeData.getHomeCopy('en'));
const requiredQuick = Object.keys(quickData.QUICKFLOW_LOCALES.en);
const requiredUi = Object.keys(toolUi.TOOL_UI_I18N.en);

for (const locale of CANONICAL_LOCALES) {
  const metadata = config.LOCALE_METADATA?.[locale];
  if (!metadata) issue.push(`${locale} | direction | runtime | missing locale metadata`);
  const dictionary = (await importTs(`src/lib/i18n/locales/${locale}.ts`))[locale];
  if (!dictionary) issue.push(`${locale} | missing | dictionary | missing locale export`);
  else {
    if (dictionary.locale !== locale) issue.push(`${locale} | structural | dictionary | locale identity is ${dictionary.locale}`);
    if (dictionary.direction !== metadata?.direction) issue.push(`${locale} | direction | dictionary | dictionary/runtime direction mismatch`);
    compare(EN_DICTIONARY, dictionary, locale, 'core dictionary');
  }

  const home = effectiveHome(locale);
  for (const key of requiredHome) if (!(key in home) || home[key] == null || (typeof home[key] === 'string' && !norm(home[key]))) issue.push(`${locale} | missing | Home | missing ${key}`);
  compare(effectiveHome('en'), home, locale, 'Home');

  const quick = effectiveQuick(locale);
  for (const key of requiredQuick) if (!(key in quick) || quick[key] == null || (typeof quick[key] === 'string' && !norm(quick[key]))) issue.push(`${locale} | missing | QuickFlow | missing ${key}`);
  compare(effectiveQuick('en'), quick, locale, 'QuickFlow');

  const ui = toolUi.TOOL_UI_I18N[locale];
  if (!ui) issue.push(`${locale} | missing | Tool UI | missing locale entry`);
  else {
    for (const key of requiredUi) if (!(key in ui) || !norm(ui[key])) issue.push(`${locale} | missing | Tool UI | missing ${key}`);
    compare(toolUi.TOOL_UI_I18N.en, ui, locale, 'Tool UI');
  }

  for (const tool of TOOLS_REGISTRY) {
    if (!tool.isReady) continue;
    const name = getAuthoritativeToolSeoName(tool, locale);
    if (!norm(name)) issue.push(`${locale} | seo | Tool SEO | missing ${tool.id}`);
  }
}

const byLocale = Object.fromEntries(CANONICAL_LOCALES.map((locale) => [locale, issue.filter((x) => x.startsWith(`${locale} |`))]));
const failedLocales = CANONICAL_LOCALES.filter((locale) => byLocale[locale].length > 0);
console.log(`Effective localization verification: ${CANONICAL_LOCALES.length - failedLocales.length}/${CANONICAL_LOCALES.length} locales PASS`);
if (failedLocales.length) {
  for (const locale of failedLocales) for (const line of byLocale[locale]) console.error(line);
  console.error(`RELEASE DECISION: BLOCKED — ${failedLocales.join(', ')}`);
  process.exit(1);
}
console.log('RELEASE DECISION: PASS — effective dictionaries, Home, QuickFlow, Tool UI, direction, and ready-tool SEO are complete.');
