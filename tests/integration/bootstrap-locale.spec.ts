import { test, expect } from '@playwright/test';

test.describe('Silent Guardian locale bootstrap', () => {
  test('applies a non-empty document locale before the application settles', async ({ page }) => {
    for (const [pathname, expectedLang, expectedDir] of [
      ['/ar', 'ar', 'rtl'],
      ['/en', 'en', 'ltr'],
    ] as const) {
      await page.goto(pathname, { waitUntil: 'domcontentloaded' });
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', /./);
      await expect(html).toHaveAttribute('dir', /./);
      await expect(html).toHaveAttribute('lang', expectedLang);
      await expect(html).toHaveAttribute('dir', expectedDir);
    }
  });
});
