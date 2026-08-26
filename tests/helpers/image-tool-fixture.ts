import { expect, type Page } from '@playwright/test';

// 4x4 RGBA PNG with distinct pixels so browser image decoders and rendering paths
// can be verified without relying on a near-white/low-information fixture.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==', 'base64');

export async function uploadFixture(page: Page, name = 'fixture.png') {
  await page.locator('#image-tool-file, input[type="file"]').first().setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
}

export async function assertImageResult(page: Page) {
  const result = page.locator('img[alt="Tool result"]');
  await expect(result).toBeVisible();
  const meta = await page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    const response = await fetch(image.src);
    const blob = await response.blob();
    return { type: blob.type, size: blob.size, width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(meta.size).toBeGreaterThan(20);
  expect(meta.width).toBeGreaterThan(0);
  expect(meta.height).toBeGreaterThan(0);
  return meta;
}

export async function assertDownload(page: Page, pattern: RegExp) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(pattern);
  expect(download.suggestedFilename()).not.toContain('undefined');
}