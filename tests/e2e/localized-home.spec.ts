import { test, expect } from '../fixtures/universal-runtime-evidence';
import { CANONICAL_LOCALES, LOCALE_METADATA } from '../../src/lib/i18n/config';

test.describe('localized home coverage', () => {
  for (const locale of CANONICAL_LOCALES) {
    const { direction, languageTag } = LOCALE_METADATA[locale];
    test(locale + ' home is localized and rendered', async ({ page }) => {
      await page.goto('/' + locale);
      await expect(page.locator('main.home-shell')).toHaveAttribute('lang', languageTag);
      await expect(page.locator('main.home-shell')).toHaveAttribute('dir', direction);
      await expect(page.locator('#home-title')).toBeVisible();
    });
  }
});
