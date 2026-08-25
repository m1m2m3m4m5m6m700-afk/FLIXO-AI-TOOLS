import { expect, test } from '@playwright/test';

test('keeps lazy tool modules out of the initial home route', async ({ page }) => {
  const homeToolRequests: string[] = [];
  const routeChunkRequests: string[] = [];
  let observingRoute = false;

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/src/tools/')) {
      if (observingRoute) routeChunkRequests.push(url);
      else homeToolRequests.push(url);
    }
    if (observingRoute && request.resourceType() === 'script' && /image-compressor|image-tool/i.test(url)) {
      routeChunkRequests.push(url);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  expect(homeToolRequests, 'home route must not eagerly request tool modules').toEqual([]);

  observingRoute = true;
  const response = await page.goto('/en/image-compressor');
  await response?.finished();
  await page.waitForLoadState('networkidle');

  await expect.poll(() => routeChunkRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
});
