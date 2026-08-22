import { test, expect } from '@playwright/test';

const locales = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'] as const;
const tools = ['background-remover', 'image-compressor', 'image-converter', 'image-cropper', 'exif-cleaner', 'background-blur'] as const;
const rtlLocales = new Set(['ar', 'ur']);

for (const tool of tools) {
  for (const locale of locales) {
    test(`${locale}/${tool} renders localized visible content`, async ({ page }) => {
      await page.goto(`/${locale}/${tool}`, { waitUntil: 'domcontentloaded' });

      const main = page.locator('main').first();
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute('lang', new RegExp(`^${locale}(?:-|$)`));
      await expect(main).toHaveAttribute('dir', rtlLocales.has(locale) ? 'rtl' : 'ltr');

      const visibleText = (await main.innerText()).replace(/\s+/g, ' ').trim();
      expect(visibleText.length).toBeGreaterThan(20);
      expect(visibleText).not.toContain('Tool not found');
    });
  }
}
