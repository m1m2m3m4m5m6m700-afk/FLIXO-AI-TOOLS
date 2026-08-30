import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const blocks = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gu)];
const routes = [...new Set(blocks.map((match) => new URL(match[1]).pathname))].sort();
const localeCodes = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
const rtlLocales = new Set(['ar', 'ur']);
const sharedTerms = new Set(['FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K', 'WebP', 'PNG', 'JPEG', 'GIF', 'SVG', 'CSV', 'JSON', 'ZIP', 'MP3', 'MP4', 'Whisper', 'WebGPU', 'WASM']);

type Snapshot = {
  title: string;
  description: string;
  h1: string;
  ui: string[];
};

const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const familyPath = (pathname: string) => {
  const match = pathname.match(new RegExp(`^/(?:${localeCodes.join('|')})(?=/|$)`, 'u'));
  return pathname.replace(match ?? '', '') || '/';
};
const englishPath = (pathname: string) => `/en${familyPath(pathname) === '/' ? '' : familyPath(pathname)}`;
const hasOnlySharedTerms = (value: string) => {
  const words = value.split(/\s+/u).filter(Boolean);
  return words.length > 0 && words.every((word) => sharedTerms.has(word.replace(/[^\p{L}\p{N}]+/gu, '')));
};

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
        return [
          node.innerText,
          node.getAttribute('aria-label'),
          node.getAttribute('title'),
          node.getAttribute('placeholder'),
          node.getAttribute('alt'),
        ].map((value) => (value ?? '').replace(/\s+/gu, ' ').trim()).find(Boolean) ?? '';
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
    await page.goto(englishPath(`/en${family === '/' ? '' : family}`), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    baselineCache.set(family, await snapshot(page));
  }
  await page.close();
});

test.afterAll(() => baselineCache.clear());

for (const pathname of routes) {
  test(`G4 all-public-route localization contract — ${pathname}`, async ({ page }) => {
    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must start with a canonical locale`).toBeTruthy();
    const expectedDirection = rtlLocales.has(locale as string) ? 'rtl' : 'ltr';

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

    await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}$`));
    await expect(page.locator('html')).toHaveAttribute('dir', expectedDirection);

    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('lang', new RegExp(`^${locale}$`));
    await expect(main).toHaveAttribute('dir', expectedDirection);

    const h1s = page.locator('h1');
    await expect(h1s).toHaveCount(1);
    await expect(h1s.first()).toHaveText(/\S+/);

    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(title.trim()).not.toBe('');
    expect(normalize(description)).not.toBe('');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
    const canonicalUrl = new URL(canonical!, page.url());
    expect(canonicalUrl.origin).toBe(new URL(process.env.VITE_SITE_URL ?? 'https://flixoai.vercel.app').origin);
    expect(canonicalUrl.pathname).toBe(pathname);
    expect(canonicalUrl.protocol).toBe('https:');

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots ?? '').toMatch(/(^|,)\s*index(?:,|\s|$)/i);
    expect(robots ?? '').toMatch(/(^|,)\s*follow(?:,|\s|$)/i);

    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) =>
      nodes.map((node) => ({ tag: node.getAttribute('hreflang') ?? '', href: node.getAttribute('href') ?? '' })),
    );
    expect(new Set(hreflangs.map((entry) => entry.tag)).size).toBe(21);
    const requiredTags = ['en','ar','es','fr','de','ru','zh-CN','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv','x-default'];
    for (const tag of requiredTags) expect(hreflangs.map((entry) => entry.tag), `${pathname} missing ${tag}`).toContain(tag);
    const selfTag = locale === 'zh' ? 'zh-CN' : locale;
    expect(hreflangs.find((entry) => entry.tag === selfTag)?.href).toBe(page.url());
    const xDefault = hreflangs.find((entry) => entry.tag === 'x-default')?.href;
    expect(xDefault).toBeTruthy();
    expect(new URL(xDefault!, page.url()).pathname).toBe(englishPath(pathname));
    for (const entry of hreflangs) {
      const href = new URL(entry.href, page.url());
      expect(href.protocol).toBe('https:');
      expect(href.origin).toBe(new URL(process.env.VITE_SITE_URL ?? 'https://flixoai.vercel.app').origin);
    }

    const baseline = baselineCache.get(familyPath(pathname));
    expect(baseline).toBeTruthy();
    const current = await snapshot(page);
    if (locale !== 'en') {
      const seoChanged = current.title !== baseline!.title || current.description !== baseline!.description || current.h1 !== baseline!.h1;
      expect(seoChanged, `${pathname} appears to reuse the English title/description/H1`).toBe(true);
      const englishUi = new Set(baseline!.ui.filter((value) => value.length >= 4 && !hasOnlySharedTerms(value)));
      const leaked = current.ui.filter((value) => englishUi.has(value));
      expect(leaked, `${pathname} contains exact English UI fallback(s): ${leaked.slice(0, 8).join(' | ')}`).toEqual([]);
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
        const labelled = node.getAttribute('aria-label') || node.getAttribute('title') || input.placeholder || node.textContent || '';
        return labelled.trim() ? [] : [`${node.tagName.toLowerCase()} missing accessible name`];
      });
    });
    expect(a11yIssues, `${pathname} accessibility naming failures`).toEqual([]);
    expect(errors, `${pathname} runtime errors`).toEqual([]);
  });
}
