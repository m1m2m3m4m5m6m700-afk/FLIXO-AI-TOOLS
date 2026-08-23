import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function makePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([420, 560]);
  return Buffer.from(await pdf.save());
}

async function downloadBuffer(download: import('@playwright/test').Download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs');
  return new Uint8Array(fs.readFileSync(path!));
}

test('pdf-unlock-protect: primary workflow is exposed', async ({ page }) => {
  await page.goto('/en/pdf-unlock-protect');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Unlock & Protect' })).toBeVisible();
  await expect(page.locator('#pdf-security-input')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Protect PDF' })).toBeVisible();
  await page.getByRole('tab', { name: 'Unlock PDF' }).click();
  await expect(page.getByRole('button', { name: 'Unlock PDF' })).toBeVisible();
});

test('pdf-unlock-protect: protects then unlocks a PDF and preserves content', async ({ page }) => {
  const input = await makePdf();
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'plain.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByLabel('User password').fill('secret123');

  const protectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  const protectedDownload = await protectDownloadPromise;
  const protectedBytes = await downloadBuffer(protectedDownload);
  expect(protectedBytes.byteLength).toBeGreaterThan(0);
  expect(protectedDownload.suggestedFilename()).toBe('plain-protected.pdf');

  await page.getByRole('tab', { name: 'Unlock PDF' }).click();
  await page.locator('#pdf-security-input').setInputFiles({ name: 'plain-protected.pdf', mimeType: 'application/pdf', buffer: Buffer.from(protectedBytes) });
  await page.getByLabel('PDF password').fill('secret123');

  const unlockDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  const unlockedDownload = await unlockDownloadPromise;
  const unlockedBytes = await downloadBuffer(unlockedDownload);
  const reopened = await PDFDocument.load(unlockedBytes);
  expect(reopened.getPageCount()).toBe(1);
  expect(unlockedDownload.suggestedFilename()).toBe('plain-protected-unlocked.pdf');
});

test('pdf-unlock-protect: wrong password is rejected without a download', async ({ page }) => {
  const input = await makePdf();
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'plain.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByLabel('User password').fill('secret123');
  const protectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  const protectedDownload = await protectDownloadPromise;
  const protectedBytes = await downloadBuffer(protectedDownload);

  await page.getByRole('tab', { name: 'Unlock PDF' }).click();
  await page.locator('#pdf-security-input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: Buffer.from(protectedBytes) });
  await page.getByLabel('PDF password').fill('wrong-password');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect password or unsupported PDF encryption');
});

test('pdf-unlock-protect: empty files are rejected', async ({ page }) => {
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await page.getByLabel('User password').fill('secret123');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF file is empty');
});

test('pdf-unlock-protect: refuses to protect an already protected PDF', async ({ page }) => {
  const input = await makePdf();
  await page.goto('/en/pdf-unlock-protect');
  await page.locator('#pdf-security-input').setInputFiles({ name: 'plain.pdf', mimeType: 'application/pdf', buffer: input });
  await page.getByLabel('User password').fill('secret123');
  const protectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  const protectedDownload = await protectDownloadPromise;
  const protectedBytes = await downloadBuffer(protectedDownload);

  await page.getByRole('tab', { name: 'Protect PDF' }).click();
  await page.locator('#pdf-security-input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: Buffer.from(protectedBytes) });
  await page.getByLabel('User password').fill('second-password');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('already password-protected');
});
