import { expect, test } from './fixtures/universal-runtime-evidence';

test.describe('Universal browser diagnostic', () => {
  test('production-like home boots with a single primary landmark', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('#home-title')).toBeVisible();
    await expect(page.locator('a[href="/en/image-compressor"]')).toBeVisible();
  });

  test('localized home preserves language and direction contracts', async ({ page }) => {
    const response = await page.goto('/ar', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('browser runtime can navigate between public locale roots without HTTP failure', async ({ page }) => {
    const first = await page.goto('/en', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(first?.status()).toBe(200);
    await page.getByRole('link', { name: 'العربية', exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/?$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main')).toHaveCount(1);
  });
});
