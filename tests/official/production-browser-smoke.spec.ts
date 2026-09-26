import { expect, test } from '../fixtures/universal-runtime-evidence';

test.describe('Production browser verification', () => {
  test('production root and Arabic locale are browser-clean', async ({ page }) => {
    const root = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(root?.status()).toBe(200);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('#home-title')).toBeVisible();

    const arabic = await page.goto('/ar', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(arabic?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main')).toHaveCount(1);
  });
});
