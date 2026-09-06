import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LOCALE_METADATA, LOCALES } from '../src/lib/i18n/config';
import { getAuthoritativeToolSeoName } from '../src/config/tool-seo-name-resolver';
import { getToolConfig } from '../src/config/tools';

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const routes = [...new Set([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gu)].map((match) => new URL(match[1]).pathname))].sort();
const localeCodes = LOCALES;
const languageTags = Object.fromEntries(LOCALES.map((locale) => [locale, LOCALE_METADATA[locale].languageTag])) as Record<(typeof localeCodes)[number], string>;
const sharedTerms = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K', 'WebP', 'PNG', 'JPEG', 'GIF', 'SVG', 'CSV', 'JSON', 'ZIP', 'MP3', 'MP4', 'Whisper', 'WebGPU', 'WASM']);
const sharedPhrases = new Set(['FLIXO AI Tools', 'FLIXO home']);

const technicalCapabilityPhrase = /^(?:WebGPU|WASM|CPU)(?:\s+(?:WebGPU|WASM|CPU))*$/u;
const technicalCodecPhrase = /^(?:WebP|JPG|PNG|JPEG|GIF|SVG)(?:\s+(?:WebP|JPG|PNG|JPEG|GIF|SVG))*$/u;
const technicalHashPhrase = /^(?:SHA-\d+)(?:\s+SHA-\d+)*$/u;
const technicalRatioValue = /^\d+:\d+$/u;
const technicalRatioList = /^(?:\d+:\d+){2,}$/u;
const technicalCaseNames = new Set([
  'UPPERCASE',
  'lowercase',
  'Title Case',
  'Sentence case',
  'camelCase',
  'PascalCase',
  'snake_case',
  'kebab-case',
  'CONSTANT_CASE',
]);
const technicalCaseList = /^(?:UPPERCASElowercaseTitle CaseSentence casecamelCasePascalCasesnake_casekebab-caseCONSTANT_CASE)$/u;
const technicalHexColor = /^#[0-9A-Fa-f]{3,8}$/u;
const sharedOnly = (value: string) => {
  const normalized = normalize(value);
  if (sharedPhrases.has(normalized)) return true;
  if (technicalCapabilityPhrase.test(normalized)) return true;
  if (technicalCodecPhrase.test(normalized)) return true;
  if (technicalHashPhrase.test(normalized)) return true;
  if (technicalRatioValue.test(normalized) || technicalRatioList.test(normalized)) return true;
  if (technicalCaseNames.has(normalized) || technicalCaseList.test(normalized)) return true;
  if (technicalHexColor.test(normalized)) return true;
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
          .map((value) => (value ?? '').replace(/\s+/gu, ' ').trim())
          .find(Boolean) ?? '';
      })
      .filter((value) => value.length >= 3);
    return {
      title: document.title.trim(),
      description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '',
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
      ui,
    };
  });
}

test.describe.configure({ mode: 'parallel' });
test.setTimeout(60_000);

for (const pathname of routes) {
  test(`G4 all-public-route localization/SEO contract — ${pathname}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('http://127.0.0.1:3000/')) runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
    });

    await page.addInitScript(() => {
      const shouldTrace = () => /^(?:\/ar\/ai-image-generator|\/ms(?:\/|$)|\/sv(?:\/|$))/.test(location.pathname);
      const emit = (kind: string, extra: Record<string, unknown>) => {
        if (!shouldTrace()) return;
        console.log('[G4 LANG WRITER]', JSON.stringify({
          kind,
          path: location.pathname,
          lang: document.documentElement.getAttribute('lang'),
          time: performance.now(),
          stack: new Error().stack,
          ...extra,
        }));
      };

      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name: string, value: string) {
        if (this === document.documentElement && name.toLowerCase() === 'lang') emit('setAttribute', { value });
        return originalSetAttribute.call(this, name, value);
      };

      const originalRemoveAttribute = Element.prototype.removeAttribute;
      Element.prototype.removeAttribute = function(name: string) {
        if (this === document.documentElement && name.toLowerCase() === 'lang') emit('removeAttribute', { name });
        return originalRemoveAttribute.call(this, name);
      };

      const langDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'lang');
      if (langDescriptor?.set && langDescriptor.get && langDescriptor.configurable) {
        Object.defineProperty(HTMLElement.prototype, 'lang', {
          configurable: langDescriptor.configurable,
          enumerable: langDescriptor.enumerable,
          get: langDescriptor.get,
          set(value: string) {
            if (this === document.documentElement) emit('property-setter', { value });
            langDescriptor.set!.call(this, value);
          },
        });
      }
    });

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must have a canonical locale prefix`).toBeTruthy();
    const localeCode = locale as (typeof localeCodes)[number];
    const expectedDirection = LOCALE_METADATA[localeCode].direction;
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
    await expect(page.locator('h1').first()).toHaveText(/\S+/u);

    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(normalize(title)).not.toBe('');
    expect(normalize(description)).not.toBe('');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
    const canonicalUrl = new URL(canonical!, page.url());
    const productionOrigin = new URL(process.env.VITE_SITE_URL ?? 'https://flixoai.vercel.app').origin;
    expect(canonicalUrl.protocol).toBe('https:');
    expect(canonicalUrl.origin).toBe(productionOrigin);
    expect(canonicalUrl.pathname).toBe(pathname);

    const robots = normalize(await page.locator('meta[name="robots"]').getAttribute('content'));
    expect(robots).toMatch(/(^|,)\s*index(?:,|\s|$)/i);
    expect(robots).toMatch(/(^|,)\s*follow(?:,|\s|$)/i);

    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) => nodes.map((node) => ({
      tag: node.getAttribute('hreflang') ?? '',
      href: node.getAttribute('href') ?? '',
    })));
    expect(hreflangs.length).toBe(localeCodes.length + 1);
    expect(new Set(hreflangs.map((entry) => entry.tag)).size).toBe(localeCodes.length + 1);
    for (const code of localeCodes) expect(hreflangs.map((entry) => entry.tag)).toContain(languageTags[code]);
    expect(hreflangs.map((entry) => entry.tag)).toContain('x-default');
    for (const entry of hreflangs) {
      const target = new URL(entry.href, page.url());
      expect(target.protocol).toBe('https:');
      expect(target.origin).toBe(productionOrigin);
    }
    for (const code of localeCodes) {
      const tag = languageTags[code];
      const found = hreflangs.find((entry) => entry.tag === tag);
      expect(found, `${pathname} missing hreflang ${tag}`).toBeTruthy();
    }

    const current = await snapshot(page);
    const baselinePath = localizedPath('en', family);
    if (localeCode !== 'en') {
      const baselinePage = await page.context().newPage();
      try {
        await baselinePage.goto(baselinePath, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await baselinePage.waitForLoadState('networkidle').catch(() => undefined);
        const baseline = await snapshot(baselinePage);
        for (const term of current.ui) expect(sharedOnly(term) || sharedOnly(baseline.ui.find((candidate) => candidate === term) ?? '')).toBeTruthy();
      } finally {
        await baselinePage.close();
      }
    }

    expect(runtimeErrors, `${pathname} runtime errors`).toEqual([]);
  });
}
