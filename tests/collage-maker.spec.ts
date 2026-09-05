import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, PNG } from './helpers/image-tool-fixture';

test('collage-maker: combines multiple images into a downloadable result', async ({ page }) => {
  await page.goto('/en/collage-maker');
  await expect(page.getByRole('heading', { level: 1, name: 'Collage Maker' })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: PNG },
    { name: 'two.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.size).toBeGreaterThan(20);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
