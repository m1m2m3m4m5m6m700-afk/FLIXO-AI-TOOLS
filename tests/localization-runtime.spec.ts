import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TOOL_SEO_NAMES } from '../src/lib/i18n/tool-seo-localization';

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const routes = [...new Set([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gu)].map((match) => new URL(match[1]).pathname))].sort();
const localeCodes = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
const languageTags: Record<(typeof localeCodes)[number], string> = {
  en: 'en', ar: 'ar', es: 'es', fr: 'fr', de: 'de', ru: 'ru', zh: 'zh-CN', hi: 'hi', id: 'id', ur: 'ur',
  ja: 'ja', pt: 'pt', it: 'it', ko: 'ko', nl: 'nl', pl: 'pl', tr: 'tr', vi: 'vi', th: 'th', sv: 'sv',
};
const rtlLocales = new Set(['ar', 'ur']);
const sharedTerms = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K', 'WebP', 'PNG', 'JPEG', 'GIF', 'SVG', 'CSV', 'JSON', 'ZIP', 'MP3', 'MP4', 'Whisper', 'WebGPU', 'WASM']);
const sharedPhrases = new Set(['FLIXO AI Tools', 'FLIXO home']);
const technicalCapabilityPhrase = /^(?:WebGPU|WASM|CPU)(?:\s+(?:WebGPU|WASM|CPU))*$/u;
const technicalCodecPhrase = /^(?:WebP|JPG|PNG|JPEG|GIF|SVG)(?:\s+(?:WebP|JPG|PNG|JPEG|GIF|SVG))*$/u;
const technicalHashPhrase = /^(?:SHA-\d+)(?:\s+SHA-\d+)*$/u;
const technicalRatioValue = /^\d+:\d+$/u;
const technicalRatioList = /^(?:\d+:\d+){2,}$/u;
const technicalCaseNames = new Set(['UPPERCASE','lowercase','Title Case','Sentence case','camelCase','PascalCase','snake_case','kebab-case','CONSTANT_CASE']);
const technicalCaseList = /^(?:UPPERCASElowercaseTitle CaseSentence casecamelCasePascalCasesnake_casekebab-caseCONSTANT_CASE)$/u;
const technicalHexColor = /^#[0-9A-Fa-f]{3,8}$/u;
const sharedOnly = (value: string) => {
  const normalized = normalize(value);
  if (sharedPhrases.has(normalized)) return true;
  if (technicalCapabilityPhrase.test(normalized) || technicalCodecPhrase.test(normalized) || technicalHashPhrase.test(normalized)) return true;
  if (technicalRatioValue.test(normalized) || technicalRatioList.test(normalized) || technicalCaseNames.has(normalized) || technicalCaseList.test(normalized) || technicalHexColor.test(normalized)) return true;
  return normalized.split(/\s+/u).filter(Boolean).every((word) => sharedTerms.has(word.replace(/[^\p{L}\p{N}]+/gu, '')));
};

type Snapshot = { title: string; description: string; h1: string; ui: string[] };
const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const familyPath = (pathname: string) => pathname.replace(new RegExp(`^/(?:${localeCodes.join('|')})(?=/|$)`, 'u'), '') || '/';
const localizedPath = (locale: string, family: string) => `/${locale}${family === '/' ? '' : family}`;

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const node = element as HTMLElement;
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const ui = [...document.querySelectorAll('button,a,input,textarea,select,[aria-label],[placeholder],[title]')]
      .filter(visible)
      .map((element) => {
        const node = element as HTMLElement;
        const input = node as HTMLInputElement;
        return [node.innerText, node.getAttribute('aria-label'), node.getAttribute('title'), input.placeholder, node.getAttribute('alt')]
          .map((value) => (value ?? '').replace(/\s+/gu, ' ').trim()).find(Boolean) ?? '';
      }).filter((value) => value.length >= 3);
    return { title: document.title.trim(), description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '', h1: document.querySelector('h1')?.textContent?.replace(/\s+/gu, ' ').trim() ?? '', ui };
  });
}

test.describe.configure({ mode: 'parallel' });
test.setTimeout(60_000);

const batch = Number.parseInt(process.env.G4_BATCH ?? '0', 10);
const batchCount = Number.parseInt(process.env.G4_BATCH_COUNT ?? '1', 10);
const batchedRoutes = batch >= 1 && batch <= batchCount
  ? routes.filter((_, index) => index % batchCount === batch - 1)
  : routes;

for (const pathname of batchedRoutes) {
  test(`G4 all-public-route localization/SEO contract — ${pathname}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('http://127.0.0.1:3000/')) runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
    });
    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must have a canonical locale prefix`).toBeTruthy();
    const localeCode = locale as (typeof localeCodes)[number];
    const expectedDirection = rtlLocales.has(localeCode) ? 'rtl' : 'ltr';
    const family = familyPath(pathname);
    await expect(page.locator('html')).toHaveAttribute('lang', languageTags[localeCode]);
    await expect(page.locator('html')).toHaveAttribute('dir', expectedDirection);
    const mains = page.locator('main');
    await expect(mains).toHaveCount(1);
    const main = mains.first();
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('lang', languageTags[localeCode]);
    await expect(main).toHaveAttribute('dir', expectedDirection);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1').first()).toHaveText(/\S+/);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(normalize(title)).not.toBe('');
    expect(normalize(description)).not.toBe('');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
    const canonicalUrl = new URL(canonical!);
    expect(canonicalUrl.pathname).toBe(pathname);
    const current = await snapshot(page);
    const baselineResponse = await page.goto(localizedPath('en', family), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(baselineResponse?.status(), `${localizedPath('en', family)} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const baseline = await snapshot(page);
    await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const englishUi = new Set(baseline.ui.filter((value) => value.length >= 4 && !sharedOnly(value)));
    const leakedEnglish = current.ui.filter((value) => englishUi.has(value));
    expect(leakedEnglish, `${pathname} exact English UI fallback(s): ${leakedEnglish.slice(0, 10).join(' | ')}`).toEqual([]);
    expect(runtimeErrors, `${pathname} runtime errors`).toEqual([]);
    const expectedLocalePaths = localeCodes.map((code) => localizedPath(code, family));
    const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((elements) => elements.map((element) => ({ hreflang: element.getAttribute('hreflang'), href: element.getAttribute('href') })));
    for (const code of localeCodes) {
      const expectedTag = languageTags[code];
      const alternate = links.find((link) => link.hreflang === expectedTag);
      expect(alternate?.href, `${pathname} hreflang=${expectedTag}`).toBeTruthy();
      expect(new URL(alternate!.href!).pathname).toBe(localizedPath(code, family));
    }
    expect(expectedLocalePaths).toHaveLength(20);
    const seoName = TOOL_SEO_NAMES[family.slice(1) as keyof typeof TOOL_SEO_NAMES];
    if (seoName) expect(normalize(title)).not.toBe('');
  });
}
