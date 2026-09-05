import { expect, test } from '@playwright/test';

test('image-cropper: rejects corrupt image payload before producing a result', async ({ page }) => {
  await page.goto('/en/image-cropper');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not a valid PNG payload'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No result yet.')).toBeVisible();
  await expect(page.locator('img[alt="Tool result"]')).toHaveCount(0);
});

test('image-cropper: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/image-cropper');

  await expect(page.getByRole('heading', { level: 1, name: 'Crop & Resize' })).toBeVisible();
  await expect(page.locator('#image-tool-file')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});
