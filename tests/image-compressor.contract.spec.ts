import { expect, test } from '@playwright/test';

test('image-compressor: rejects corrupt image payload before producing output', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid PNG payload'),
  });

  await page.getByRole('button', { name: 'Compress image' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
});

test('image-compressor: rejects empty input before processing', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compress image' })).toBeDisabled();
});

test('image-compressor: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/image-compressor');

  await expect(page.getByRole('heading', { name: 'Compress Images Online' })).toBeVisible();
  await expect(page.locator('#image-file')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Compress image' })).toBeVisible();
});
