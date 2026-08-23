import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';

async function makePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([420, 560]);
  return Buffer.from(await pdf.save());
}

async function makeEncryptedPdf(password: string) {
  const plain = await makePdf();
  const encrypted = await encryptPDF(new Uint8Array(plain), password);
  return Buffer.from(encrypted);
}

test('pdf-unlock-protect: protect workflow is exposed', async ({ page }) => {
  await page.goto('/en/pdf-unlock-protect');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Unlock & Protect' })).toBeVisible();
  await expect(page.locator('#pdf-security-input')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Protect PDF' })).toBeVisible();
});

test('pdf-unlock-protect: protects a valid PDF and preserves page count', async ({ page }) => {
  const input = await makePdf();
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'plain.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByLabel('User password').fill('secret123');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  const fs = await import('node:fs');
  const output = new Uint8Array(fs.readFileSync(path!));
  const info = await isEncrypted(output);
  expect(info.encrypted).toBe(true);
  expect(download.suggestedFilename()).toBe('plain-protected.pdf');

  const decryptedRoundTrip = await decryptPDF(output, 'secret123');
  const reopened = await PDFDocument.load(decryptedRoundTrip);
  expect(reopened.getPageCount()).toBe(1);
});

test('pdf-unlock-protect: rejects a wrong password', async ({ page }) => {
  const encrypted = await makeEncryptedPdf('secret123');
  await page.goto('/en/pdf-unlock-protect');
  await page.getByRole('tab', { name: 'Unlock PDF' }).click();
  await page.locator('#pdf-security-input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: encrypted });
  await page.getByLabel('PDF password').fill('wrong-password');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect password');
});

test('pdf-unlock-protect: unlocks with the correct password and returns readable PDF', async ({ page }) => {
  const encrypted = await makeEncryptedPdf('secret123');
  await page.goto('/en/pdf-unlock-protect');
  await page.getByRole('tab', { name: 'Unlock PDF' }).click();
  await page.locator('#pdf-security-input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: encrypted });
  await page.getByLabel('PDF password').fill('secret123');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  const fs = await import('node:fs');
  const output = new Uint8Array(fs.readFileSync(path!));
  const info = await isEncrypted(output);
  expect(info.encrypted).toBe(false);
  const reopened = await PDFDocument.load(output);
  expect(reopened.getPageCount()).toBe(1);
  expect(download.suggestedFilename()).toBe('locked-unlocked.pdf');
});

test('pdf-unlock-protect: rejects empty files', async ({ page }) => {
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await page.getByLabel('User password').fill('secret123');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF file is empty');
});
