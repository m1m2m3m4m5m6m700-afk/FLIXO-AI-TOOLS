import { expect, test, type Page } from '@playwright/test';
import { TOOL_SEO_NAMES } from '../src/lib/i18n/tool-seo-localization';

const routes = [
  '/ar/case-converter',
  '/ar/color-picker-palette',
  '/ar/hash-generator',
  '/ar/image-compressor',
  '/ar/image-to-pdf',
  '/ar/json-formatter-validator',
  '/ar/qr-generator-reader',
  '/ar/regex-tester',
  '/ar/text-diff-checker',
] as const;

const sharedTerms = new Set([
  'FLIXO', 'QuickFlow', 'OCR', 'PDF', 'English', 'العربية', 'Smart Intent', 'Ctrl K',
  'WebP', 'PNG', 'JPEG', 'GIF', 'SVG', 'CSV', 'JSON', 'ZIP', 'MP3', 'MP4', 'Whisper',
  'WebGPU', 'WASM', 'CPU', 'JPG', 'SHA-256', 'SHA-384', 'SHA-512', 'YAML',
]);
const sharedPhrases = new Set(['FLIXO AI Tools', 'FLIXO home']);
const technicalRatio = /^\d+:\d+$/u;
const technicalHex = /^#[0-9A-Fa-f]{3,8}$/u;
const technicalCase = /^(?:UPPERCASE|lowercase|Title Case|Sentence case|camelCase|PascalCase|snake_case|kebab-case|CONSTANT_CASE)$/u;
const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const sharedOnly = (value: string) => {
  const normalized = normalize(value);
  if (sharedPhrases.has(normalized) || technicalRatio.test(normalized) || technicalHex.test(normalized) || technicalCase.test(normalized)) return true;
  return normalized.split(/\s+/u).filter(Boolean).every((word) => sharedTerms.has(word.replace(/[^\p{L}\p{N}-]+/gu, '')));
};

async function uiSnapshot(page: Page) {
  return page.evaluate(() => {
    const normalizeInPage = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
    return [...document.querySelectorAll('button,a,input,textarea,select,[aria-label],[placeholder],[title]')]
      .filter((element) => {
        const node = element as HTMLElement;
        if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => {
        const node = element as HTMLElement;
        const input = node as HTMLInputElement;
        return [node.innerText, node.getAttribute('aria-label'), node.getAttribute('title'), input.placeholder, node.getAttribute('alt')]
          .map((value) => normalizeInPage(value))
          .find(Boolean) ?? '';
      })
      .filter((value) => value.length >= 4);
  });
}

test.describe('Fast browser localization smoke', () => {
  test.describe.configure({ mode: 'parallel' });
  test.setTimeout(45_000);

  for (const pathname of routes) {
    test(`${pathname} exposes reviewed Arabic UI`, async ({ page }) => {
      const response = await page.goto(pathname, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${pathname} must return HTTP 200`).toBe(200);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('ar');
      await expect.poll(() => page.locator('html').getAttribute('dir')).toBe('rtl');

      const expectedH1 = TOOL_SEO_NAMES[pathname.replace(/^\/ar\//u, '')]?.ar;
      if (expectedH1) await expect(page.locator('h1')).toContainText(expectedH1);

      const arabicUi = await uiSnapshot(page);
      await page.goto(pathname.replace(/^\/ar(?=\/)/u, '/en'), { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const englishUi = await uiSnapshot(page);
      const englishSet = new Set(englishUi.filter((value) => !sharedOnly(value)));
      const leaked = arabicUi.filter((value) => englishSet.has(value) && !sharedOnly(value));
      expect(leaked, `${pathname} Arabic UI must not exactly reuse English UI: ${leaked.slice(0, 10).join(' | ')}`).toEqual([]);
    });
  }
});
