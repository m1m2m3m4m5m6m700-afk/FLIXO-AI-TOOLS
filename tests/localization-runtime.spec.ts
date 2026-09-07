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
    page.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`);
      console.log(`[G4 PAGEERROR] ${error.stack || error.message}`);
    });
    page.on('console', (message) => {
      console.log(`[G4 BROWSER ${message.type()}] ${message.text()}`);
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      const failure = `${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`;
      console.log(`[G4 REQUESTFAILED] ${failure}`);
      if (request.url().startsWith('http://127.0.0.1:3000/')) runtimeErrors.push(`requestfailed: ${failure}`);
    });

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log(`[G4 NAV] pathname=${pathname} url=${page.url()} status=${response?.status() ?? 'null'}`);
    console.log(`[G4 HTML BEFORE ASSERT] ${await page.locator('html').getAttribute('lang')}`);
    expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must have a canonical locale prefix`).toBeTruthy();
    const localeCode = locale as (typeof localeCodes)[number];
    const expectedDirection = LOCALE_METADATA[localeCode].direction;
    const family = familyPath(pathname);

    await expect(page.locator('html')).toHaveAttribute('lang', languageTags[localeCode]);
    await expect(page.locator('html')).toHaveAttribute('dir', expectedDirection);
