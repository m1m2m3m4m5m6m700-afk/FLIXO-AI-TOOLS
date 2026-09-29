import { expect, test } from '../fixtures/universal-runtime-evidence';

test('i18n runtime boundary: user-owned text remains unchanged', async ({ page }) => {
  await page.goto('/ar/image-upscaler');
  await expect(page.locator('[data-flixo-i18n-root="tool-surface"]')).toBeVisible();

  const userText = '2';
  const input = page.locator('[data-flixo-i18n-root="tool-surface"] input:not([type="file"])').first();
  await input.fill(userText);

  await page.waitForTimeout(250);
  await expect(input).toHaveValue(userText);
});

test('i18n runtime boundary: scoped tool root is the only declared runtime surface', async ({ page }) => {
  await page.goto('/ar/image-upscaler');
  await expect(page.locator('[data-flixo-i18n-root="tool-surface"]')).toHaveCount(1);
  await expect(page.locator('body > [data-flixo-i18n-root]')).toHaveCount(0);
});
