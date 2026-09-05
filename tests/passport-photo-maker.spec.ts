import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('passport-photo-maker: produces a valid portrait image', async ({ page }) => {
  await page.goto('/en/passport-photo-maker');
  await expect(page.getByRole('heading', { level: 1, name: 'Passport Photo Maker' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toMatch(/^image\//);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
