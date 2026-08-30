import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const routes = [...new Set([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gu)].map((match) => new URL(match[1]).pathname))].sort();
const localeCodes = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
const languageTags: Record<(typeof localeCodes)[number], string> = {
  en: 'en', ar: 'ar', es: 'es', fr: 'fr', de: 'de', ru: 'ru', zh: 'zh-CN', hi: 'hi', id: 'id', ur: 'ur',
  ja: 'ja', pt: 'pt', it: 'it', ko: 'ko', nl: 'nl', pl: 'pl', tr: 'tr', vi: 'vi', th: 'th', sv: 'sv',
};
const rtlLocales = new Set(['ar', 'ur']);
const sharedTerms = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K', 'WebP', 'PNG', 'JPEG', 'GIF', 'SVG', 'CSV', 'JSON', 'ZIP', 'MP3', 'MP4', 'Whisper', 'WebGPU', 'WASM']);

type Snapshot = { title: string; description: string; h1: string; ui: string[] };

const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const familyPath = (pathname: string) => pathname.replace(new RegExp(`^/(?:${localeCodes.join('|')})(?=/|$)`, 'u'), '') || '/';
const localizedPath = (locale: string, family: string) => `/${locale}${family === '/' ? '' : family}`;
const sharedOnly = (value: string) => value.split(/\s+/u).filter(Boolean).every((word) => sharedTerms.has(word.replace(/[^\p{L}\p{N}]+/gu, '')));

async function snapshot(page: Parameters<typeof test>[0]['page']): Promise<Snapshot> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const node = element as HTMLElement;
      if (node.hidden) return false;
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

const baselineCache = new Map<string, Snapshot>();

test.describe.configure({ mode: 'parallel' });
test.setTimeout(60_000);

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const families = [...new Set(routes.map(familyPath))];
  for (const family of families) {
    const response = await page.goto(localizedPath('en', family), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    baselineCache.set(family, await snapshot(page));
  }
  await page.close();
});

test.afterAll(() => baselineCache.clear());

for (const pathname of routes) {
  test(`G4 all-public-route localization/SEO contract — ${pathname}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    page.on('requestfailed', (request) => runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`));

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must have a canonical locale prefix`).toBeTruthy();
    const expectedDirection = rtlLocales.has(locale as string) ? 'rtl' : 'ltr';
    const family = familyPath(pathname);

    await expect(page.locator('html')).toHaveAttribute('lang', languageTags[locale as (typeof localeCodes)[number]]);
    await expect(page.locator('html')).toHaveAttribute('dir', expectedDirection);

    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('lang', languageTags[locale as (typeof localeCodes)[number]]);
    await expect(main).toHaveAttribute('dir', expectedDirection);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1').first()).toHaveText(/\S+/);

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
    expect(new Set(hreflangs.map((entry) => entry.tag)).size).toBe(21);
    for (const code of localeCodes) expect(hreflangs.map((entry) => entry.tag)).toContain(languageTags[code]);
    expect(hreflangs.map((entry) => entry.tag)).toContain('x-default');
    for (const entry of hreflangs) {
      const target = new URL(entry.href, page.url());
      expect(target.protocol).toBe('https:');
      expect(target.origin).toBe(productionOrigin);
    }
    for (const code of localeCodes) {
      const tag = languageTags[code];
      const target = new URL(hreflangs.find((entry) => entry.tag === tag)!.href, page.url());
      expect(target.pathname, `${pathname} hreflang ${tag} target`).toBe(localizedPath(code, family));
    }
    expect(new URL(hreflangs.find((entry) => entry.tag === languageTags[locale as (typeof localeCodes)[number]])!.href, page.url()).pathname).toBe(pathname);
    expect(new URL(hreflangs.find((entry) => entry.tag === 'x-default')!.href, page.url()).pathname).toBe(localizedPath('en', family));

    const current = await snapshot(page);
    const baseline = baselineCache.get(family);
    expect(baseline).toBeTruthy();
    if (locale !== 'en') {
      const seoDiffers = current.title !== baseline!.title || current.description !== baseline!.description || current.h1 !== baseline!.h1;
      expect(seoDiffers, `${pathname} appears to reuse English title/description/H1`).toBe(true);
      const englishUi = new Set(baseline!.ui.filter((value) => value.length >= 4 && !sharedOnly(value)));
      const leakedEnglish = current.ui.filter((value) => englishUi.has(value));
      expect(leakedEnglish, `${pathname} exact English UI fallback(s): ${leakedEnglish.slice(0, 10).join(' | ')}`).toEqual([]);
    }

    const a11yIssues = await page.locator('button,a,input,textarea,select,img').evaluateAll((nodes) => {
      const visible = (element: Element) => {
        const node = element as HTMLElement;
        if (node.hidden) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      return nodes.filter(visible).flatMap((element) => {
        const node = element as HTMLElement;
        if (node.tagName === 'IMG') {
          const img = node as HTMLImageElement;
          if (img.getAttribute('aria-hidden') === 'true' || img.getAttribute('role') === 'presentation') return [];
          return img.alt.trim() ? [] : ['visible image missing alt'];
        }
        const input = node as HTMLInputElement;
        const name = node.getAttribute('aria-label') || node.getAttribute('title') || input.placeholder || node.textContent || '';
        return name.trim() ? [] : [`${node.tagName.toLowerCase()} missing accessible name`];
      });
    });
    expect(a11yIssues, `${pathname} accessibility naming failures`).toEqual([]);
    expect(runtimeErrors, `${pathname} runtime/console/request failures`).toEqual([]);
  });
}
