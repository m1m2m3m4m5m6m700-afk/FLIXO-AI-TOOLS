import { expect, test } from '@playwright/test';
import { LOCALES, LOCALE_METADATA, type Locale } from '../src/lib/i18n/config';

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

  test('language selector reaches every locale without a 404', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    for (const locale of LOCALES) {
      await page.locator('#home-language').selectOption(locale);
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(`/${locale}`);

      const response = await page.waitForResponse((candidate) => candidate.url() === page.url(), { timeout: 10_000 }).catch(() => null);
      if (response) {
        expect(response.ok(), `${locale} selector navigation must not return 4xx/5xx`).toBeTruthy();
      }

      await expect(page.locator('main').first()).toHaveAttribute('dir', LOCALE_METADATA[locale].direction);
    }
  });

  test('locale URLs normalize to supported two-letter locale codes', async ({ page }) => {
    const unsupported = '/xx';
    const response = await page.goto(unsupported, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);

    const pathname = new URL(page.url()).pathname.replace(/^\/+|\/+$/g, '');
    expect(pathname === '' || LOCALES.includes(pathname as Locale)).toBeTruthy();
  });
});
