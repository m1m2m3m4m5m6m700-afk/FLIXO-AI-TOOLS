import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([420, 560]);
  first.drawText('FLIXO first page text', { x: 40, y: 500, size: 18, font, color: rgb(0, 0, 0) });
  const second = pdf.addPage([420, 560]);
  second.drawText('Second page has extractable words', { x: 40, y: 500, size: 18, font, color: rgb(0, 0, 0) });
  return Buffer.from(await pdf.save());
}

async function readDownload(download: import('@playwright/test').Download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs');
  return fs.readFileSync(path!);
}

test('pdf-to-text: route and primary controls are exposed', async ({ page }) => {
  await page.goto('/en/pdf-to-text');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF to Text' })).toBeVisible();
  await expect(page.locator('#pdf-to-text-input')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Extract Text' })).toBeVisible();
});

test('pdf-to-text: extracts every page and reports accurate counts', async ({ page }) => {
  await page.goto('/en/pdf-to-text');
  await page.locator('#pdf-to-text-input').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await makePdf() });
  await page.getByRole('button', { name: 'Extract Text' }).click();
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
  await expect(page.getByText('FLIXO first page text')).toBeVisible();
  await expect(page.getByText('Second page has extractable words')).toBeVisible();
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
});

test('pdf-to-text: search filters page results', async ({ page }) => {
  await page.goto('/en/pdf-to-text');
  await page.locator('#pdf-to-text-input').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await makePdf() });
  await page.getByRole('button', { name: 'Extract Text' }).click();
  const search = page.getByLabel('Search extracted text');
  await search.fill('Second page');
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 1', { exact: true })).not.toBeVisible();
});

test('pdf-to-text: TXT and JSON exports contain extracted content', async ({ page }) => {
  await page.goto('/en/pdf-to-text');
  await page.locator('#pdf-to-text-input').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await makePdf() });
  await page.getByRole('button', { name: 'Extract Text' }).click();

  const txtPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download TXT' }).click();
  const txt = await readDownload(await txtPromise);
  expect(txt.toString('utf8')).toContain('FLIXO first page text');
  expect(txt.toString('utf8')).toContain('Second page has extractable words');

  const jsonPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const json = JSON.parse((await readDownload(await jsonPromise)).toString('utf8')) as Array<{ pageNumber: number; text: string; wordCount: number }>;
  expect(json).toHaveLength(2);
  expect(json[0].pageNumber).toBe(1);
  expect(json[0].text).toContain('FLIXO first page text');
  expect(json[1].pageNumber).toBe(2);
  expect(json[1].wordCount).toBeGreaterThan(0);
});

test('pdf-to-text: rejects empty and non-PDF files', async ({ page }) => {
  await page.goto('/en/pdf-to-text');
  await page.locator('#pdf-to-text-input').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await page.getByRole('button', { name: 'Extract Text' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF file is empty');

  await page.locator('#pdf-to-text-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a pdf') });
  await page.getByRole('button', { name: 'Extract Text' }).click();
  await expect(page.getByRole('alert')).toContainText('Please select a PDF file');
});
