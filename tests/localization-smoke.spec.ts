import { expect, test } from '@playwright/test';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config';

test.describe('20-locale language selector navigation', () => {
  test.describe.configure({ timeout: 45_000 });

  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    test(`language selector navigates en to ${locale}`, async ({ page }) => {
      await page.goto('/en', { waitUntil: 'domcontentloaded' });
      const languageSelector = page.locator('#home-language');

      await expect(page.locator('main').first()).toHaveAttribute('lang', LOCALE_METADATA.en.languageTag);
      await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA.en.direction);
      await expect(languageSelector).toBeVisible();

      await languageSelector.selectOption(locale);
      await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
      await expect(page.locator('main').first()).toHaveAttribute('lang', LOCALE_METADATA[locale].languageTag);
      await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA[locale].direction);
    });
  }
});
