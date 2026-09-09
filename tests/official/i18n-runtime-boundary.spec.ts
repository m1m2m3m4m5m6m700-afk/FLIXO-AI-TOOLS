import { expect, test } from '../fixtures/universal-runtime-evidence';

test('i18n runtime boundary: user-owned text remains unchanged', async ({ page }) => {
  await page.goto('/ar/image-upscaler');
  await expect(page.locator('[data-flixo-i18n-root="tool-surface"]')).toBeVisible();

  const userText = 'Encode';
  const textarea = page.locator('[data-flixo-i18n-root="tool-surface"] textarea').first();
  await textarea.evaluate((element, value) => {
    element.setAttribute('data-boundary-probe', 'true');
    (element as HTMLTextAreaElement).value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, userText);

  await page.waitForTimeout(250);
  await expect(textarea).toHaveValue(userText);
});

test('i18n runtime boundary: scoped tool root is the only declared runtime surface', async ({ page }) => {
  await page.goto('/ar/image-upscaler');
  await expect(page.locator('[data-flixo-i18n-root="tool-surface"]')).toHaveCount(1);
  await expect(page.locator('body > [data-flixo-i18n-root]')).toHaveCount(0);
});
