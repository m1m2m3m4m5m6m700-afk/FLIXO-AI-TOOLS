import { expect, test } from '@playwright/test';

test('application boots with image-first homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#home-title')).toBeVisible();
  await expect(page.locator('a[href="/en/image-compressor"]')).toBeVisible();
});
