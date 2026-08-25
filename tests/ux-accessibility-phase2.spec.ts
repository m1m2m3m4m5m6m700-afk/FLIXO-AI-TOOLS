import { expect, test } from '@playwright/test';

const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#223344"/></svg>`;
const oversizedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="9000" viewBox="0 0 9000 9000"><rect width="9000" height="9000" fill="#223344"/></svg>`;

test.describe('UX + Accessibility phase 2 workflow contract', () => {
  test('covers upload and validation states accessibly', async ({ page }) => {
    await page.goto('/en/image-compressor');

    const input = page.locator('#image-file');
    await expect(input).toHaveAttribute('type', 'file');
    await expect(page.locator('label[for="image-file"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compress image' })).toBeDisabled();

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    await input.setInputFiles({ name: 'oversized.jpg', mimeType: 'image/jpeg', buffer: oversized });

    await expect(page.getByRole('alert')).toContainText('Some files were skipped');
    await expect(page.getByRole('button', { name: 'Compress image' })).toBeDisabled();
  });

  test('exposes processing and completion semantics', async ({ page }) => {
    await page.goto('/en/image-compressor');

    await page.locator('#image-file').setInputFiles({
      name: 'source.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(validSvg),
    });

    const action = page.getByRole('button', { name: 'Compress image', exact: true });
    await expect(action).toBeEnabled();
    await action.click();

    await expect(page.locator('.compressor-grid')).toHaveAttribute('aria-busy', 'true');
    await expect(action).toBeDisabled();
    await expect(action).toHaveAttribute('aria-disabled', 'true');

    const download = page.getByRole('link', { name: 'Download image' });
    await expect(download).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
    await expect(page.locator('.compressor-grid')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('complementary').getByText('WebP', { exact: true })).toBeVisible();
  });

  test('keeps export and result information keyboard and screen-reader reachable', async ({ page }) => {
    await page.goto('/en/image-compressor');
    await page.locator('#image-file').setInputFiles({
      name: 'source.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(validSvg),
    });
    await page.getByRole('button', { name: 'Compress image', exact: true }).click();

    const download = page.getByRole('link', { name: 'Download image' });
    await expect(download).toHaveAttribute('href', /^blob:/, { timeout: 15000 });
    await expect(download).toBeEnabled();
    await expect(page.getByRole('complementary')).toBeVisible();

    await download.focus();
    await expect(download).toBeFocused();
    await expect(page.getByRole('complementary')).toContainText(/WebP|1200 × 800/);
  });

  test('announces processing errors without exposing a download result', async ({ page }) => {
    await page.goto('/en/image-compressor');
    await page.locator('#image-file').setInputFiles({
      name: 'huge.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(oversizedSvg),
    });
    await page.getByRole('button', { name: 'Compress image', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('source image is too large for safe browser processing', { timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Compress image', exact: true })).toBeEnabled();
  });

  test('preserves the same workflow contract in Arabic RTL', async ({ page }) => {
    await page.goto('/ar/image-compressor');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main.image-tool-shell')).toHaveAttribute('dir', 'rtl');

    await page.locator('#image-file').setInputFiles({
      name: 'source.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(validSvg),
    });
    await expect(page.getByRole('button', { name: 'ضغط الصورة', exact: true })).toBeEnabled();
  });
});
