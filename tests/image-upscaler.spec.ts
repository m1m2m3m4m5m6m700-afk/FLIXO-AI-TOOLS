import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('image-upscaler: scales dimensions and downloads PNG', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await expect(page.getByRole('heading', { level: 1, name: 'Image Upscaler' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  expect(result.width).toBe(8);
  expect(result.height).toBe(8);
  await assertDownload(page, /\.png$/);
});

test('image-upscaler: rejects an unsafe scale', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await uploadFixture(page);
  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('9');
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('Scale must be between 0.25 and 4.');
});
