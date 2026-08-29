import { expect, test } from '@playwright/test';

const locales = [
  { code: 'en', languageTag: 'en', direction: 'ltr' },
  { code: 'ar', languageTag: 'ar', direction: 'rtl' },
  { code: 'es', languageTag: 'es', direction: 'ltr' },
  { code: 'fr', languageTag: 'fr', direction: 'ltr' },
  { code: 'de', languageTag: 'de', direction: 'ltr' },
  { code: 'ru', languageTag: 'ru', direction: 'ltr' },
  { code: 'zh', languageTag: 'zh-CN', direction: 'ltr' },
  { code: 'hi', languageTag: 'hi', direction: 'ltr' },
  { code: 'id', languageTag: 'id', direction: 'ltr' },
  { code: 'ur', languageTag: 'ur', direction: 'rtl' },
  { code: 'ja', languageTag: 'ja', direction: 'ltr' },
  { code: 'pt', languageTag: 'pt', direction: 'ltr' },
  { code: 'it', languageTag: 'it', direction: 'ltr' },
  { code: 'ko', languageTag: 'ko', direction: 'ltr' },
  { code: 'nl', languageTag: 'nl', direction: 'ltr' },
  { code: 'pl', languageTag: 'pl', direction: 'ltr' },
  { code: 'tr', languageTag: 'tr', direction: 'ltr' },
  { code: 'vi', languageTag: 'vi', direction: 'ltr' },
  { code: 'th', languageTag: 'th', direction: 'ltr' },
  { code: 'sv', languageTag: 'sv', direction: 'ltr' },
] as const;

test.describe('20-locale rendered runtime certification', () => {
  for (const locale of locales) {
    test(`home runtime is localized for ${locale.code}`, async ({ page }) => {
      const response = await page.goto(`/${locale.code}`);
      expect(response?.ok()).toBeTruthy();

      await expect(page.locator('#home-title')).toBeVisible();
      await expect(page.locator('main.home-shell')).toHaveAttribute('lang', locale.languageTag);
      await expect(page.locator('main.home-shell')).toHaveAttribute('dir', locale.direction);
      await expect(page.locator('html')).toHaveAttribute('lang', locale.languageTag);
      await expect(page.locator('html')).toHaveAttribute('dir', locale.direction);

      await expect(page.locator('#tool-search')).toHaveAttribute('placeholder', /.+/);
      await expect(page.locator('.home-lead')).toHaveText(/\S+/);
      await expect(page.locator('.home-nav-language')).toHaveValue(locale.code);
      await expect(page.locator('.home-tools-grid .home-tool-card').first()).toBeVisible();
    });

    test(`representative tool runtime is localized for ${locale.code}`, async ({ page }) => {
      const response = await page.goto(`/${locale.code}/image-compressor`);
      expect(response?.ok()).toBeTruthy();

      await expect(page.locator('.tool-page-modern__title')).toBeVisible();
      await expect(page.locator('main.tool-page-modern')).toHaveAttribute('lang', locale.languageTag);
      await expect(page.locator('main.tool-page-modern')).toHaveAttribute('dir', locale.direction);
      await expect(page.locator('html')).toHaveAttribute('lang', locale.languageTag);
      await expect(page.locator('html')).toHaveAttribute('dir', locale.direction);

      await expect(page.locator('.tool-page-modern__description')).toHaveText(/\S+/);
      await expect(page.locator('.tool-page-modern__badge')).toHaveText(/\S+/);
      await expect(page.locator('.tool-page-modern__seo-card').first()).toBeVisible();
    });
  }
});
