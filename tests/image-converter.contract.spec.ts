import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

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

test('image-converter: verifies the actual downloaded WebP bytes', async ({ page }) => {
  await page.goto('/en/image-converter');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('img', { name: 'Tool result' })).toBeVisible();
  await expect(page.getByText(/Output: 1 × 1px/)).toBeVisible();

  const downloadLink = page.getByRole('link', { name: 'Download pixel.webp' });
  await expect(downloadLink).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pixel.webp');

  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);

  expect(bytes.length).toBeGreaterThan(0);
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
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
