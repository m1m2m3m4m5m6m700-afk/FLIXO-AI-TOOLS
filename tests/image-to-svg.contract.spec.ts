import { expect, test } from '@playwright/test';

test('image-to-svg: rejects corrupt image payload before producing SVG', async ({ page }) => {
  await page.goto('/en/image-to-svg');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid PNG payload'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download now' })).toHaveCount(0);
});

test('image-to-svg: rejects empty file before decoding', async ({ page }) => {
  await page.goto('/en/image-to-svg');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toContainText('file size must be a positive integer');
});

test('image-to-svg: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/image-to-svg');
  await expect(page.getByRole('heading', { level: 1, name: 'Image to SVG' })).toBeVisible();
  await expect(page.locator('input[type="file"]').first()).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});
