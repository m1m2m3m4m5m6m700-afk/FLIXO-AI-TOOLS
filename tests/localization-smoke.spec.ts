import { expect, test } from '@playwright/test';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config';

test.describe('20-locale navigation', () => {
  test.describe.configure({ timeout: 45_000 });

  for (const locale of LOCALES) {
    test(`direct ${locale} home route returns 200 with correct direction`, async ({ page }) => {
      const response = await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${locale} home route must return a successful HTTP response`).toBeTruthy();
      await expect(page.locator('main').first()).toHaveAttribute('lang', LOCALE_METADATA[locale].languageTag);
      await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA[locale].direction);
    });
  }

  test('language selector reaches every supported locale', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    const languageSelector = page.locator('#home-language');

    await expect(page.locator('main').first()).toHaveAttribute('lang', LOCALE_METADATA.en.languageTag);
    await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA.en.direction);
    await expect(languageSelector).toBeVisible();

    for (const locale of LOCALES.filter((value) => value !== 'en')) {
      await languageSelector.selectOption(locale);
      await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
      await expect(page.locator('main').first()).toHaveAttribute('lang', LOCALE_METADATA[locale].languageTag);
      await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA[locale].direction);
      await expect(page.locator('#home-language')).toBeVisible();
    }
  });
});
