import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('meme-generator: creates a valid meme image', async ({ page }) => {
  await page.goto('/en/meme-generator');
  await expect(page.getByRole('heading', { level: 1, name: 'Meme Generator' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toMatch(/^image\//);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
