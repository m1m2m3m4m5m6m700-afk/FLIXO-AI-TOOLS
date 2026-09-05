import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('image-effects: applies effects and keeps a valid image result', async ({ page }) => {
  await page.goto('/en/image-effects');
  await expect(page.getByRole('heading', { level: 1, name: 'Image Effects' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toMatch(/^image\//);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
