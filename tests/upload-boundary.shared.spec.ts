import { expect, test } from '@playwright/test';

test('shared upload boundary rejects a PNG with JPEG MIME metadata', async ({ page }) => {
  await page.goto('/en/image-converter');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'payload.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });

  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('input signature does not match the allowed file signatures');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('shared upload boundary rejects a valid PNG signature with the wrong extension', async ({ page }) => {
  await page.goto('/en/image-converter');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'payload.jpg',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });

  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('unsupported file extension: jpg');
  await expect(page.getByText('No result yet.')).toBeVisible();
});
