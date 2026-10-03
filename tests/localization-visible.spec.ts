import { test, expect } from './fixtures/universal-runtime-evidence';
import { CANONICAL_LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config';

const locales = CANONICAL_LOCALES;
const tools = ['background-remover', 'image-compressor', 'image-converter', 'image-cropper', 'exif-cleaner', 'background-blur'] as const;

for (const tool of tools) {
  for (const locale of locales) {
    test(locale + '/' + tool + ' renders localized visible content', async ({ page }) => {
      await page.goto('/' + locale + '/' + tool, { waitUntil: 'domcontentloaded' });

      const main = page.locator('main').first();
      await expect(main).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp('^' + LOCALE_METADATA[locale].languageTag + '(?:-|$)'));
      await expect(main).toHaveAttribute('dir', LOCALE_METADATA[locale].direction);

      const visibleText = (await main.innerText()).replace(/\s+/g, ' ').trim();
      expect(visibleText.length).toBeGreaterThan(20);
      expect(visibleText).not.toContain('Tool not found');
    });
  }
}
