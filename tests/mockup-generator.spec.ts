import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('mockup-generator: creates a valid device mockup', async ({ page }) => {
  await page.goto('/en/mockup-generator');
  await expect(page.getByRole('heading', { level: 1, name: 'Mockup Generator' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toMatch(/^image\//);
  await assertDownload(page, /\.(png|jpg|webp)$/);
});
