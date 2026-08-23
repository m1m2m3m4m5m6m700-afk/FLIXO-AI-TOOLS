import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function makePdf(pageCount: number, marker: string) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([320, 420]);
    page.drawText(`${marker}-${index + 1}`, { x: 40, y: 360, size: 18 });
  }
  return Buffer.from(await pdf.save());
}

test('pdf-merger-splitter: merges two PDFs and preserves page order', async ({ page }) => {
  await page.goto('/en/pdf-merger-splitter');
  await page.locator('#pdf-input').setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(2, 'A') },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: await makePdf(1, 'B') },
  ]);

  await expect(page.getByText('3 pages')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Merge 3 pages' }).click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();
  const merged = await PDFDocument.load(outputPath!);
  expect(merged.getPageCount()).toBe(3);
});

test('pdf-merger-splitter: deletes and rotates a selected page before merge', async ({ page }) => {
  await page.goto('/en/pdf-merger-splitter');
  await page.locator('#pdf-input').setInputFiles({
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(2, 'S'),
  });

  await page.getByRole('button', { name: /#1 · source\.pdf · 1/ }).click();
  await page.getByRole('button', { name: 'Rotate selected' }).click();
  await expect(page.getByText('Rotation 90°')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('1 pages')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge 1 pages' })).toBeVisible();
});

test('pdf-merger-splitter: validates invalid split ranges', async ({ page }) => {
  await page.goto('/en/pdf-merger-splitter');
  await page.locator('#pdf-input').setInputFiles({
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(2, 'S'),
  });
  await page.getByLabel('Page range').fill('3-4');
  await page.getByRole('button', { name: 'Split range' }).click();
  await expect(page.getByRole('alert')).toContainText('Page range must be between 1 and 2');
});

test('pdf-merger-splitter: splits a valid page range', async ({ page }) => {
  await page.goto('/en/pdf-merger-splitter');
  await page.locator('#pdf-input').setInputFiles({
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(4, 'S'),
  });
  await page.getByLabel('Page range').fill('2-3');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Split range' }).click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();
  const split = await PDFDocument.load(outputPath!);
  expect(split.getPageCount()).toBe(2);
});

test('pdf-merger-splitter: rejects a non-PDF upload', async ({ page }) => {
  await page.goto('/en/pdf-merger-splitter');
  await page.locator('#pdf-input').setInputFiles({
    name: 'not-pdf.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('nope'),
  });
  await expect(page.getByRole('alert')).toContainText('Please select one or more PDF files');
  await expect(page.getByText('No pages loaded yet.')).toBeVisible();
});
