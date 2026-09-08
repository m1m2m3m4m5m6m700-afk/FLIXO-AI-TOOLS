import { expect, test } from './fixtures/universal-runtime-evidence';

const hugeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="9000" viewBox="0 0 9000 9000"><rect width="9000" height="9000" fill="#223344"/></svg>';

test('Large pixel dimensions are rejected before expensive canvas work', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({ name: 'huge.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(hugeSvg) });
  await page.getByRole('button', { name: 'Compress image' }).click();
  await expect(page.getByRole('alert')).toContainText('source image is too large for safe browser processing', { timeout: 15000 });
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
});

test('Arabic image compressor exposes localized SEO and output controls', async ({ page }) => {
  await page.goto('/ar/image-compressor');
  await expect(page.getByRole('heading', { level: 1, name: 'ضغط الصور أونلاين' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('a[lang="en"]').filter({ hasText: 'English' })).toHaveAttribute('href', '/en/image-compressor');
  await expect(page.locator('meta[name="description"][content*="اضغط صور JPG وPNG وWebP أونلاين"]')).toHaveCount(1);
});

test('runtime diagnostics capture an application error without breaking the page', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'diagnostic-smoke-test', error: new Error('diagnostic-smoke-test') }));
  });
  const diagnostic = await page.evaluate(() => {
    const raw = localStorage.getItem('flixo:runtime-diagnostics');
    return raw ? JSON.parse(raw).at(-1) : null;
  });
  expect(diagnostic).toMatchObject({ kind: 'error', message: 'diagnostic-smoke-test' });
  await expect(page.getByRole('heading', { level: 1, name: 'Image Compressor' })).toBeVisible();
});
