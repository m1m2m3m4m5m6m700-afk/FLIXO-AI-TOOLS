import { expect, test } from '@playwright/test';

const fileInput = (page: Parameters<typeof test>[0] extends never ? never : any) => page.locator('input[type="file"]').first();

test('exif-cleaner: rejects corrupt image payload before producing a result', async ({ page }) => {
  await page.goto('/en/exif-cleaner');
  await fileInput(page).setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid PNG payload'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('img[alt="Tool result"]')).toHaveCount(0);
});

test('exif-cleaner: rejects empty file before decoding', async ({ page }) => {
  await page.goto('/en/exif-cleaner');
  await fileInput(page).setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('file size must be a positive integer');
});

test('exif-cleaner: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/exif-cleaner');
  await expect(page.getByRole('heading', { level: 1, name: 'EXIF Cleaner' })).toBeVisible();
  await expect(fileInput(page)).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});
