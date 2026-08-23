import { expect, test } from '@playwright/test';

test('shared image safety rejects a MIME-spoofed PNG before decoding', async ({ page }) => {
  await page.goto('/en/background-remover');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'spoofed.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not a PNG'),
  });

  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('input signature does not match the allowed file signatures');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('shared image safety rejects a MIME-spoofed JPEG before decoding', async ({ page }) => {
  await page.goto('/en/object-remover');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'spoofed.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('this is not a JPEG'),
  });

  await page.getByRole('textbox', { name: 'X', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Y', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Width', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Height', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toContainText('input signature does not match the allowed file signatures');
  await expect(page.getByText('No result yet.')).toBeVisible();
});
