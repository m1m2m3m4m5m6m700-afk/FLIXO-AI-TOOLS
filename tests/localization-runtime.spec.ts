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
const traceRoute = '/ar/ai-captioner-srt';
const technicalCapabilityPhrase = /^(?:WebGPU|WASM|CPU)(?:\s+(?:WebGPU|WASM|CPU))*$/u;
const technicalCodecPhrase = /^(?:WebP|JPG|PNG|JPEG|GIF|SVG)(?:\s+(?:WebP|JPG|PNG|JPEG|GIF|SVG))*$/u;
const technicalHashPhrase = /^(?:SHA-\d+)(?:\s+SHA-\d+)*$/u;
const technicalRatioValue = /^\d+:\d+$/u;
const technicalRatioList = /^(?:\d+:\d+){2,}$/u;
const technicalCaseNames = new Set(['UPPERCASE', 'lowercase', 'Title Case', 'Sentence case', 'camelCase', 'PascalCase', 'snake_case', 'kebab-case', 'CONSTANT_CASE']);
const technicalCaseList = /^(?:UPPERCASElowercaseTitle CaseSentence casecamelCasePascalCasesnake_casekebab-caseCONSTANT_CASE)$/u;
const technicalHexColor = /^#[0-9A-Fa-f]{3,8}$/u;
const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const sharedOnly = (value: string) => {
  const normalized = normalize(value);
  if (sharedPhrases.has(normalized) || technicalCapabilityPhrase.test(normalized) || technicalCodecPhrase.test(normalized) || technicalHashPhrase.test(normalized) || technicalRatioValue.test(normalized) || technicalRatioList.test(normalized) || technicalCaseNames.has(normalized) || technicalCaseList.test(normalized) || technicalHexColor.test(normalized)) return true;
  return normalized.split(/\s+/u).filter(Boolean).every((word) => sharedTerms.has(word.replace(/[^\p{L}\p{N}]+/gu, '')));
};

type Snapshot = { title: string; description: string; h1: string; ui: string[] };

const familyPath = (pathname: string) => pathname.replace(new RegExp(`^/(?:${localeCodes.join('|')})(?=/|$)`, 'u'), '') || '/';
const localizedPath = (locale: string, family: string) => `/${locale}${family === '/' ? '' : family}`;

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const visible = (element: Element) => { const node = element as HTMLElement; if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false; const style = window.getComputedStyle(node); return style.display !== 'none' && style.visibility !== 'hidden'; };
    const ui = [...document.querySelectorAll('button,a,input,textarea,select,[aria-label],[placeholder],[title]')].filter(visible).map((element) => { const node = element as HTMLElement; const input = node as HTMLInputElement; return [node.innerText, node.getAttribute('aria-label'), node.getAttribute('title'), input.placeholder, node.getAttribute('alt')].map((value) => (value ?? '').replace(/\s+/gu, ' ').trim()).find(Boolean) ?? ''; }).filter((value) => value.length >= 3);
    return { title: document.title.trim(), description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '', h1: document.querySelector('h1')?.textContent?.replace(/\s+/gu, ' ').trim() ?? '', ui };
  });
}

test.describe.configure({ mode: 'parallel' });
test.setTimeout(60_000);

for (const pathname of routes) {
  test(`G4 all-public-route localization/SEO contract — ${pathname}`, async ({ page }) => {
    const runtimeErrors: string[] = [];

    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[G4 NATIVE READ]')) console.log(text);
      if (message.type() === 'error') runtimeErrors.push(`console: ${text}`);
    });
    page.on('requestfailed', (request) => { if (request.url().startsWith('http://127.0.0.1:3000/')) runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`); });

    await page.addInitScript(() => {
      const rawGetAttribute = Element.prototype.getAttribute;
      const rawSetAttribute = Element.prototype.setAttribute;
      const rawRemoveAttribute = Element.prototype.removeAttribute;
      let reads = 0;
      const emit = (kind: string, value: string | null) => {
        if (reads >= 64) return;
        reads += 1;
        const html = document.documentElement;
        const lang = html ? rawGetAttribute.call(html, 'lang') : null;
        const dir = html ? rawGetAttribute.call(html, 'dir') : null;
        console.log(`[G4 NATIVE READ] ${JSON.stringify({ kind, value, lang, dir, time: performance.now() })}`);
      };
      window.addEventListener('DOMContentLoaded', () => emit('DOMContentLoaded', null));
      window.addEventListener('load', () => emit('load', null));
      Element.prototype.setAttribute = function(name: string, value: string) {
        if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit(`setAttribute:${name}`, value);
        return rawSetAttribute.call(this, name, value);
      };
      Element.prototype.removeAttribute = function(name: string) {
        if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit(`removeAttribute:${name}`, null);
        return rawRemoveAttribute.call(this, name);
      };
      Element.prototype.getAttribute = function(name: string) {
        const value = rawGetAttribute.call(this, name);
        if (this === document.documentElement && name === 'lang') emit('getAttribute:lang', value);
        return value;
      };
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
    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) => nodes.map((node) => ({ tag: node.getAttribute('hreflang') ?? '', href: node.getAttribute('href') ?? '' })));
    expect(hreflangs.length).toBe(localeCodes.length + 1);
    expect(new Set(hreflangs.map((entry) => entry.tag)).size).toBe(localeCodes.length + 1);
    for (const code of localeCodes) expect(hreflangs.map((entry) => entry.tag)).toContain(languageTags[code]);
    expect(hreflangs.map((entry) => entry.tag)).toContain('x-default');
    for (const entry of hreflangs) { const target = new URL(entry.href, page.url()); expect(target.protocol).toBe('https:'); expect(target.origin).toBe(productionOrigin); }
    for (const code of localeCodes) { const tag = languageTags[code]; const found = hreflangs.find((entry) => entry.tag === tag); expect(found, `${pathname} missing hreflang ${tag}`).toBeTruthy(); const target = new URL(found!.href, page.url()); expect(target.pathname, `${pathname} hreflang ${tag} target`).toBe(localizedPath(code, family)); }
    expect(new URL(hreflangs.find((entry) => entry.tag === languageTags[localeCode])!.href, page.url()).pathname).toBe(pathname);
    expect(new URL(hreflangs.find((entry) => entry.tag === 'x-default')!.href, page.url()).pathname).toBe(localizedPath('en', family));

    if (localeCode !== 'en') {
      const baselineResponse = await page.goto(localizedPath('en', family), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      expect(baselineResponse?.status(), `${pathname} English baseline ${family} must return HTTP 200`).toBe(200);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const baseline = await snapshot(page);
      const localizedResponse = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      expect(localizedResponse?.status(), `${pathname} must return HTTP 200 after baseline comparison`).toBe(200);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const current = await snapshot(page);
      expect(current.title, `${pathname} must not reuse English document title`).not.toBe(baseline.title);
      expect(current.description, `${pathname} must not reuse English meta description`).not.toBe(baseline.description);
      expect(current.h1, `${pathname} must not reuse English H1`).not.toBe(baseline.h1);
      const englishUi = new Set(baseline.ui.filter((value) => value.length >= 4 && !sharedOnly(value)));
      const leakedEnglish = current.ui.filter((value) => englishUi.has(value));
      expect(leakedEnglish, `${pathname} exact English UI fallback(s): ${leakedEnglish.slice(0, 10).join(' | ')}`).toEqual([]);
      const toolFamily = family.slice(1);
      const tool = toolFamily ? getToolConfig(toolFamily) : undefined;
      const expectedToolName = tool ? getAuthoritativeToolSeoName(tool, localeCode) : undefined;
      if (expectedToolName) expect(current.h1, `${pathname} must expose the authoritative localized tool name`).toContain(expectedToolName);
    }

    const a11yIssues = await page.locator('button,a,input,textarea,select,img').evaluateAll((nodes) => {
      const visible = (element: Element) => { const node = element as HTMLElement; if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false; const style = window.getComputedStyle(node); return style.display !== 'none' && style.visibility !== 'hidden'; };
      const referencedLabelText = (element: HTMLElement) => (element.getAttribute('aria-labelledby') ?? '').split(/\s+/u).filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      return nodes.filter(visible).flatMap((element) => {
        const node = element as HTMLElement;
        if (node.tagName === 'IMG') { const img = node as HTMLImageElement; if (img.getAttribute('role') === 'presentation') return []; return img.alt.trim() ? [] : ['visible image missing alt']; }
        const input = node as HTMLInputElement;
        const explicitLabel = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent ?? '' : '';
        const parentLabel = node.closest('label')?.textContent ?? '';
        const name = [node.getAttribute('aria-label'), referencedLabelText(node), explicitLabel, parentLabel, node.getAttribute('title'), input.placeholder, node.textContent].map((value) => (value ?? '').trim()).find(Boolean) ?? '';
        return name ? [] : [`${node.tagName.toLowerCase()} missing accessible name`];
      });
    });
    expect(a11yIssues, `${pathname} accessibility naming failures`).toEqual([]);
    expect(runtimeErrors, `${pathname} runtime/console/request failures`).toEqual([]);
  });
}
