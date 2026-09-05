import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function makePdf(pageCount: number) {
  const sourcePdf = await PDFDocument.create();
  const font = await sourcePdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = sourcePdf.addPage([420, 560]);
    page.drawText(`FLIXO PDF compressor output contract page ${index + 1}`, { x: 30, y: 520, size: 16, font });
    for (let line = 0; line < 80; line += 1) {
      page.drawText(`Deterministic contract sample ${line + 1} / page ${index + 1}`, { x: 30, y: 495 - line * 5, size: 7, font });
    }
  }
  return Buffer.from(await sourcePdf.save());
}

test('pdf-compressor: exposes the primary workflow and levels', async ({ page }) => {
  await page.goto('/en/pdf-compressor');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Compressor' })).toBeVisible();
  await expect(page.locator('#pdf-compressor-input')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('radio', { name: 'low' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'medium' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'high' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compress PDF' })).toBeVisible();
});

test('pdf-compressor: rejects empty input', async ({ page }) => {
  await page.goto('/en/pdf-compressor');
  await page.locator('#pdf-compressor-input').setInputFiles({
    name: 'empty.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF file is empty');
});

test('pdf-compressor: produces a valid PDF and never returns a larger output', async ({ page }) => {
  const input = await makePdf(2);
  await page.goto('/en/pdf-compressor');
  await page.locator('#pdf-compressor-input').setInputFiles({
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: input,
  });
  await page.getByRole('radio', { name: 'high' }).check();
  await page.getByRole('button', { name: 'Compress PDF' }).click();

  await expect(page.getByText(/size reduction · 2 pages/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download compressed PDF' }).click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();

  const outputBytes = fs.readFileSync(outputPath!);
  expect(outputBytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(outputBytes.length).toBeLessThanOrEqual(input.length);

  const outputPdf = await PDFDocument.load(outputBytes);
  expect(outputPdf.getPageCount()).toBe(2);
  expect(download.suggestedFilename()).toBe('flixo-compressed.pdf');
});

test('pdf-compressor: rejects non-PDF input', async ({ page }) => {
  await page.goto('/en/pdf-compressor');
  await page.locator('#pdf-compressor-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a pdf'),
  });
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Please select a PDF file');
});
