import { expect, test } from '@playwright/test';


test('image-converter: rejects corrupt image payload before producing a result', async ({ page }) => {
  await page.goto('/en/image-converter');
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

test('image-converter: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/image-converter');

  const heading = page.getByRole('heading', { level: 1, name: 'Image Converter' });
  await expect(heading).toBeVisible();

  const fileInput = page.locator('#image-tool-file');
  await expect(fileInput).toHaveAttribute('type', 'file');

  const outputFormat = page.getByLabel('Output format');
  await expect(outputFormat).toBeVisible();

  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});
