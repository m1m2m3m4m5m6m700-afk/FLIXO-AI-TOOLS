import { expect, test, type Page } from '@playwright/test';
import { imageCompressorOutputContract } from '../src/tools/image-compressor/output-contract';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#223344"/><circle cx="300" cy="220" r="180" fill="#67e8f9"/><circle cx="850" cy="560" r="260" fill="#164e63"/><text x="600" y="430" text-anchor="middle" fill="white" font-size="110" font-family="sans-serif">FLIXO</text></svg>`;
const hugeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="9000" viewBox="0 0 9000 9000"><rect width="9000" height="9000" fill="#223344"/></svg>`;

function outputFormat(page: Page, value: string) {
  return page.locator('select').first().selectOption(value);
}

function control(page: Page, text: string) {
  return page.locator('label').filter({ hasText: text }).locator('input');
}

async function validateDownloadedImage(page: Page, href: string, expectedMime: string, expectedWidth: number, expectedHeight: number) {
  expect(imageCompressorOutputContract.outputMimeTypes).toContain(expectedMime);
  expect(imageCompressorOutputContract.downloadRequired).toBe(true);

  return page.evaluate(async ({ href: objectUrl, expectedMimeType, expectedW, expectedH }) => {
    const response = await fetch(objectUrl);
    if (!response.ok) throw new Error(`Output blob fetch failed: ${response.status}`);
    const blob = await response.blob();
    if (blob.size < 1) throw new Error('Output blob is empty');
    if (blob.type !== expectedMimeType) throw new Error(`Unexpected MIME type: ${blob.type}`);

    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const signature = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const signatures: Record<string, string> = {
      'image/png': '89504e470d0a1a0a',
      'image/jpeg': 'ffd8ff',
      'image/webp': '52494646',
    };
    const expectedSignature = signatures[expectedMimeType];
    if (!expectedSignature || !signature.startsWith(expectedSignature)) {
      throw new Error(`Unexpected output signature: ${signature}`);
    }

    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height, bytes: blob.size, mimeType: blob.type };
    bitmap.close();
    if (dimensions.width !== expectedW || dimensions.height !== expectedH) {
      throw new Error(`Unexpected dimensions: ${dimensions.width}x${dimensions.height}`);
    }
    return dimensions;
  }, { href, expectedMimeType: expectedMime, expectedW: expectedWidth, expectedH: expectedHeight });
}

test('English image compressor produces a real WebP output', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await expect(page.getByRole('heading', { name: 'Compress Images Online' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'العربية' })).toHaveAttribute('href', '/ar/image-compressor');
  await expect(page.locator('meta[name="description"]').filter({ hasText: 'Compress JPG, PNG, and WebP images online in your browser.' })).toHaveAttribute(
    'content',
    /Compress JPG, PNG, and WebP images online in your browser\./,
  );

  await page.locator('#image-file').setInputFiles({ name: 'source.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.getByRole('button', { name: 'Compress image' }).click();

  const download = page.getByRole('link', { name: 'Download image' });
  await expect(download).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
  await expect(page.getByText(/smaller file size/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('complementary').getByText('WebP', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('complementary').getByText('1200 × 800', { exact: true })).toBeVisible();

  const href = await download.getAttribute('href');
  expect(href).toMatch(/^blob:/);
  await validateDownloadedImage(page, href!, 'image/webp', 1200, 800);
});

test('PNG output and resizing produce the requested dimensions', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({ name: 'source.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await outputFormat(page, 'image/png');
  await control(page, 'Max width').fill('600');
  await page.getByRole('button', { name: 'Compress image' }).click();

  const download = page.getByRole('link', { name: 'Download image' });
  await expect(download).toHaveAttribute('download', 'flixo-compressed.png', { timeout: 15000 });
  await expect(page.getByRole('complementary').getByText('PNG', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByText('600 × 400', { exact: true })).toBeVisible();
  const href = await download.getAttribute('href');
  expect(href).toMatch(/^blob:/);
  await validateDownloadedImage(page, href!, 'image/png', 600, 400);
});

test('Target size optimization respects a safe size ceiling', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({ name: 'source.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await control(page, 'Target size (KB)').fill('20');
  await page.getByRole('button', { name: 'Compress image' }).click();

  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
  const after = page.getByRole('complementary').locator('dd').nth(1);
  await expect(after).toContainText(/KB|B/);
  const afterText = await after.textContent();
  const match = afterText?.match(/([0-9.]+)\s*(KB|B)/);
  expect(match).not.toBeNull();
  const sizeBytes = match?.[2] === 'KB' ? Number(match[1]) * 1024 : Number(match?.[1]);
  expect(sizeBytes).toBeLessThanOrEqual(20 * 1024);
});

test('Batch processing produces a ZIP for multiple images', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles([
    { name: 'one.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) },
    { name: 'two.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) },
  ]);
  await expect(page.getByText('2 images selected')).toBeVisible();
  await page.getByRole('button', { name: 'Compress all to ZIP' }).click();

  const download = page.getByRole('link', { name: 'Download ZIP' });
  await expect(download).toHaveAttribute('download', 'flixo-compressed-images.zip', { timeout: 15000 });
  await expect(page.getByRole('complementary').getByText('2', { exact: true })).toBeVisible();
  await expect(download).toHaveAttribute('href', /^(blob:)/);
});

test('Input limit rejects oversized files before processing', async ({ page }) => {
  await page.goto('/en/image-compressor');
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
  await page.locator('#image-file').setInputFiles({ name: 'oversized.jpg', mimeType: 'image/jpeg', buffer: oversized });

  await expect(page.getByRole('alert')).toContainText('Some files were skipped');
  await expect(page.getByRole('button', { name: 'Compress image' })).toBeDisabled();
});

test('Large pixel dimensions are rejected before expensive canvas work', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles({ name: 'huge.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(hugeSvg) });
  await page.getByRole('button', { name: 'Compress image' }).click();

  await expect(page.getByRole('alert')).toContainText('source image is too large for safe browser processing', { timeout: 15000 });
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
});

test('Arabic image compressor exposes localized SEO and output controls', async ({ page }) => {
  await page.goto('/ar/image-compressor');
  await expect(page.getByRole('heading', { name: 'ضغط الصور أونلاين' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/image-compressor');
  await expect(page.locator('meta[name="description"]').filter({ hasText: 'اضغط صور JPG وPNG وWebP' })).toHaveAttribute('content', /اضغط صور JPG وPNG وWebP/);
});

test('runtime diagnostics capture an application error without breaking the page', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'diagnostic-smoke-test',
        error: new Error('diagnostic-smoke-test'),
      }),
    );
  });

  const diagnostic = await page.evaluate(() => {
    const raw = localStorage.getItem('flixo:runtime-diagnostics');
    return raw ? JSON.parse(raw).at(-1) : null;
  });

  expect(diagnostic).toMatchObject({
    kind: 'error',
    message: 'diagnostic-smoke-test',
  });
  await expect(page.getByRole('heading', { name: 'Compress Images Online' })).toBeVisible();
});
