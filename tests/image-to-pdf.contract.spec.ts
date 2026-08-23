import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function makePng(width: number, height: number, color: string) {
  const pngData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  expect(color).toBeTruthy();
  return { pngData, width, height };
}

test('image-to-pdf: exposes workflow controls', async ({ page }) => {
  await page.goto('/en/image-to-pdf');
  await expect(page.getByRole('heading', { level: 1, name: 'Image to PDF' })).toBeVisible();
  await expect(page.locator('#image-to-pdf-input')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('radio', { name: 'Portrait' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Landscape' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'None' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Small' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Large' })).toBeVisible();
});

test('image-to-pdf: rejects missing images', async ({ page }) => {
  await page.goto('/en/image-to-pdf');
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await expect(page.getByRole('button', { name: 'Create PDF' })).toBeDisabled();
});

test('image-to-pdf: creates valid PDF with deterministic page count and landscape pages', async ({ page }) => {
  const image = await makePng(1, 1, 'test');
  await page.goto('/en/image-to-pdf');
  await page.locator('#image-to-pdf-input').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: image.pngData },
    { name: 'second.png', mimeType: 'image/png', buffer: image.pngData },
  ]);
  await page.getByRole('radio', { name: 'Landscape' }).check();
  await page.getByRole('radio', { name: 'Large' }).check();
  await page.getByRole('button', { name: 'Create PDF' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();
  const fs = await import('node:fs');
  const outputBytes = fs.readFileSync(outputPath!);
  expect(outputBytes.subarray(0, 5).toString()).toBe('%PDF-');

  const pdf = await PDFDocument.load(outputBytes);
  expect(pdf.getPageCount()).toBe(2);
  for (const pdfPage of pdf.getPages()) {
    expect(pdfPage.getWidth()).toBe(792);
    expect(pdfPage.getHeight()).toBe(612);
  }
  expect(download.suggestedFilename()).toBe('flixo-images.pdf');
});

test('image-to-pdf: rejects unsupported formats', async ({ page }) => {
  await page.goto('/en/image-to-pdf');
  await page.locator('#image-to-pdf-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Only JPG, PNG, and WEBP images are supported');
});
