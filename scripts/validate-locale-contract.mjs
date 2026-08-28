import { existsSync, readFileSync } from 'node:fs';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const root = process.cwd();
const locale = process.env.FLIXO_LOCALE ?? process.argv[2];
if (!locale || !CANONICAL_LOCALES.includes(locale)) {
  console.error(`Locale contract requires one canonical locale: ${CANONICAL_LOCALES.join(', ')}`);
  process.exit(1);
}

const errors = [];
const fail = (message) => errors.push(`${locale}: ${message}`);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const en = read('src/lib/i18n/locales/en.ts');
const locPath = `src/lib/i18n/locales/${locale}.ts`;

if (!existsSync(`${root}/${locPath}`)) {
  fail(`missing locale dictionary ${locPath}`);
} else {
  const loc = read(locPath);
  if (!loc.includes(`locale: '${locale}'`)) fail('locale identifier mismatch');
  for (const key of ['homeTitle:', 'homeDescription:']) if (!new RegExp(`${key}\\s*'[^']+'`, 'u').test(loc)) fail(`missing ${key}`);

  const extract = (source, key) => source.match(new RegExp(`${key}\\s*'([^']*)'`, 'u'))?.[1] ?? '';
  if (locale !== 'en') {
    for (const key of ['homeTitle:', 'homeDescription:']) {
      const enValue = extract(en, key);
      const locValue = extract(loc, key);
      if (enValue && locValue === enValue) fail(`English fallback in ${key}`);
      if (!locValue.trim()) fail(`empty translation in ${key}`);
    }
  }

  const config = read('src/lib/i18n/config.ts');
  const direction = config.match(new RegExp(`${locale}:\\s*\\{[^}]*direction:\\s*'([^']+)'`, 'u'))?.[1];
  const expectedDirection = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
  if (direction !== expectedDirection) fail(`direction mismatch: expected ${expectedDirection}, found ${direction ?? '<missing>'}`);

  const home = read('src/data/home-locales.ts');
  const quick = read('src/data/quickflow-locales.ts');
  const ui = read('src/data/tool-ui-i18n.ts');
  const homeKeys = ['nav:', 'badge:', 'eyebrow:', 'heroTitle:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'suggested:', 'openDirectly:', 'popular:', 'trust:', 'quickDrop:', 'quickDropTitle:', 'quickDropLead:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolbox:', 'toolboxTitle:', 'ready:', 'empty:', 'builtForFocus:', 'finalTitle:', 'finalLead:', 'trySmart:', 'all:', 'browserMeta:', 'ariaHome:', 'ariaPrimary:', 'ariaFindTool:', 'ariaTrust:', 'ariaCategories:', 'quickTags:'];
  const quickKeys = ['missing:', 'back:', 'eyebrow:', 'runLabel:', 'choose:', 'processing:', 'result:', 'download:', 'chooseError:', 'failure:', 'running:', 'run:', 'resultAlt:', 'progress:'];
  const uiKeys = ['notFound:', 'loading:', 'language:', 'about:', 'howTo:', 'features:', 'navigation:', 'home:', 'ready:', 'waiting:', 'workspace:', 'favorite:', 'english:', 'arabic:', 'command:', 'openCommandPalette:', 'upload:', 'reset:', 'exportLabel:', 'localWorkspace:'];
  const entry = (source, marker) => source.match(new RegExp(`\\b${locale}:\\s*${marker}\\(\\{([\\s\\S]*?)\\n\\s*[a-z]{2}:\\s*(?:copy|q)\\(\\{`, 'u'))?.[1] ?? source.match(new RegExp(`\\b${locale}:\\s*${marker}\\(\\{([\\s\\S]*?)\\n\\};`, 'u'))?.[1] ?? '';
  const objectBody = source => source.match(new RegExp(`\\b${locale}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`, 'u'))?.[1] ?? '';
  const homeEntry = entry(home, 'copy');
  const quickEntry = entry(quick, 'q');
  const uiEntry = objectBody(ui);
  for (const key of homeKeys) if (!homeEntry.includes(key)) fail(`Home missing ${key}`);
  for (const key of quickKeys) if (!quickEntry.includes(key)) fail(`QuickFlow missing ${key}`);
  for (const key of uiKeys) if (!uiEntry.includes(key)) fail(`Tool UI missing ${key}`);

  if (locale !== 'en') {
    const extractEntryValue = (body, key) => body.match(new RegExp(`${key}\\s*'([^']*)'`, 'u'))?.[1] ?? '';
    const enHome = home.match(/\\ben:\\s*copy\\(\\{([\\s\\S]*?)\\n\\s*ar:\\s*copy\\(\\{/u)?.[1] ?? '';
    const enQuick = quick.match(/\\ben:\\s*q\\(\\{([\\s\\S]*?)\\n\\s*ar:\\s*q\\(\\{/u)?.[1] ?? '';
    for (const key of ['badge:', 'heroLead:', 'describe:', 'searchLabel:', 'searchPlaceholder:', 'smartPalette:', 'popular:', 'quickDropTitle:', 'dropChoose:', 'dropSupport:', 'suggestedTool:', 'openTool:', 'toolboxTitle:', 'empty:', 'finalTitle:', 'finalLead:', 'trySmart:']) {
      const a = extractEntryValue(enHome, key); const b = extractEntryValue(homeEntry, key);
      if (a && b === a) fail(`Home English fallback in ${key}`);
    }
    for (const key of quickKeys.filter((k) => k !== 'resultAlt:')) {
      const a = extractEntryValue(enQuick, key); const b = extractEntryValue(quickEntry, key);
      if (a && b === a) fail(`QuickFlow English fallback in ${key}`);
    }
  }

  const heroEn = extract(en, 'homeTitle:');
  const heroLoc = homeEntry.match(/heroTitle:\s*'([^']*)'/u)?.[1] ?? '';
  if (heroEn.includes('<span>') !== heroLoc.includes('<span>') || heroEn.includes('</span>') !== heroLoc.includes('</span>')) fail('heroTitle HTML emphasis structure differs from English');

  const seo = read('src/lib/i18n/tool-seo-localization.ts');
  const seoObjects = [...seo.matchAll(/Object\.freeze\(\{([^}]*)\}\)/gu)].map((m) => m[1]);
  if (!seoObjects.length) fail('SEO localization registry is empty');
  for (const [index, body] of seoObjects.entries()) if (!new RegExp(`\\b${locale}:`, 'u').test(body)) fail(`SEO name entry ${index + 1} missing ${locale}`);

  const expectedScript = {
    ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u, ur: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u,
    ru: /[\u0400-\u04ff]/u, zh: /[\u3400-\u9fff]/u, ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
    ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u, hi: /[\u0900-\u097f]/u, th: /[\u0e00-\u0e7f]/u,
  }[locale];
  if (expectedScript) {
    const candidates = [extractEntryValue(homeEntry, 'heroLead:'), extractEntryValue(homeEntry, 'describe:'), extractEntryValue(homeEntry, 'searchPlaceholder:'), extractEntryValue(quickEntry, 'choose:'), extractEntryValue(uiEntry, 'about:')].filter(Boolean).join(' ');
    if ([...candidates].filter((char) => /\p{L}/u.test(char)).length >= 12 && !expectedScript.test(candidates)) fail('expected locale script is not represented in translated UI samples');
  }

  const suspicious = ['Privacy-first', 'Browser-first', 'Instant start', 'Smart routing', 'Open smart command palette', 'Start with the tools people actually need.'];
  if (locale !== 'en') for (const term of suspicious) if (homeEntry.includes(`'${term}'`) || homeEntry.includes(`"${term}"`)) fail(`suspicious English phrase leaked: ${term}`);
}

if (errors.length) {
  console.error(`LOCALIZATION TEST FAILED — ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`LOCALIZATION TEST PASSED — ${locale}`);
