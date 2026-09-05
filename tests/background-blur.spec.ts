import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('background-blur: produces a valid processed image', async ({ page }) => {
  await page.goto('/en/background-blur');
  await expect(page.getByRole('heading', { level: 1, name: 'Background Blur' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toMatch(/^image\//);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
