import { expect, test } from '@playwright/test';

test.describe('UX + Accessibility phase 1', () => {
  test('moves focus to the tool heading after navigation', async ({ page }) => {
    await page.goto('/en/image-compressor');
    const heading = page.getByRole('heading', { name: 'Compress Images Online' });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute('tabindex', '-1');
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent)).toContain('Compress Images Online');
  });

  test('exposes a keyboard and screen-reader friendly primary workflow', async ({ page }) => {
    await page.goto('/en/image-compressor');

    await expect(page.locator('#image-file')).toHaveAttribute('type', 'file');
    await expect(page.locator('label[for="image-file"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compress image' })).toBeVisible();
    await expect(page.locator('.tool-page-modern__workspace')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.tool-page-modern__tool-host')).toHaveAttribute('aria-live', 'polite');

    await page.keyboard.press('Tab');
    await expect(page.locator('a[aria-label="FLIXO home"]')).toBeFocused();
  });

  test('keeps Arabic tool shell in RTL with the same focus contract', async ({ page }) => {
    await page.goto('/ar/image-compressor');
    const heading = page.getByRole('heading', { name: 'ضغط الصور أونلاين' });
    await expect(heading).toBeVisible();
    await expect(page.locator('main.tool-page-modern')).toHaveAttribute('dir', 'rtl');
    await expect(heading).toHaveAttribute('tabindex', '-1');
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent)).toContain('ضغط الصور أونلاين');
  });
});
