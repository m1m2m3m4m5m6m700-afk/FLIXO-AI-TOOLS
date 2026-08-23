import { expect, test } from '@playwright/test';

test.describe('AR/EN localization smoke', () => {
  test('English home exposes English UI and document LTR direction', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('nav')).toContainText('Tools');
    await expect(page.locator('h1')).toContainText('The right tool');
  });

  test('Arabic home exposes Arabic UI and RTL direction', async ({ page }) => {
    await page.goto('/ar/');
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('nav')).toContainText('الأدوات');
    await expect(page.locator('h1')).toContainText('الأداة المناسبة');
  });

  test('Arabic localized tool shell keeps RTL and translated upload state', async ({ page }) => {
    await page.goto('/ar/image-compressor');
    await expect(page.locator('main').first()).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('body')).toContainText('اختر الصور للبدء');
  });
});
