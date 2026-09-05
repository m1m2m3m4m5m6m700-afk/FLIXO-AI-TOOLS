import { expect, test } from '@playwright/test';

test('image-upscaler: rejects corrupt image payload before producing a result', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid PNG payload'),
  });
  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No result yet.')).toBeVisible();
  await expect(page.locator('img[alt="Tool result"]')).toHaveCount(0);
});

test('image-upscaler: rejects empty file before decoding', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toContainText('file size must be a positive integer');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('image-upscaler: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await expect(page.getByRole('heading', { level: 1, name: 'Image Upscaler' })).toBeVisible();
  await expect(page.locator('#image-tool-file')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('textbox', { name: 'Scale', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});