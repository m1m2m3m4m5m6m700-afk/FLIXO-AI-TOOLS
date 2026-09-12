import { expect, test } from '../fixtures/universal-runtime-evidence';

test('global logo renders the canonical raster directly', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });

  const logo = page.locator('a[aria-label="FLIXO AI Tools"] img[alt="FLIXO AI Tools"]');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/flixo-logo.jpg');
  await expect(logo).toHaveJSProperty('naturalWidth', 1254);
  await expect(logo).toHaveJSProperty('naturalHeight', 1254);

  const resource = await page.evaluate(() => {
    const image = document.querySelector('a[aria-label="FLIXO AI Tools"] img[alt="FLIXO AI Tools"]') as HTMLImageElement | null;
    if (!image) return null;
    return {
      src: image.currentSrc,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  });

  expect(resource).toEqual({
    src: new URL('/flixo-logo.jpg', page.url()).href,
    complete: true,
    naturalWidth: 1254,
    naturalHeight: 1254,
  });
});
