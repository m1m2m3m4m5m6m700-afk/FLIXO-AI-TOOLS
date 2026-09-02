import { test, expect } from '@playwright/test';

test.describe('bootstrap locale integration', () => {
  test('sets a non-empty document language before hydration settles', async ({ page }) => {
    await page.goto('/ar', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
    await expect(page.locator('html')).toHaveAttribute('dir', /^(rtl|ltr)$/);
  });
});
