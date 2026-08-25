import { expect, test } from '@playwright/test';

const isProductionPreview = process.env.PLAYWRIGHT_SERVER === 'preview';

test('keeps lazy tool modules out of the initial home route', async ({ page }) => {
  test.skip(!isProductionPreview, 'Production bundle boundary is certified on preview; Vite dev source-graph requests are not equivalent to production chunk loading.');

  const homeToolRequests: string[] = [];
  const homeScriptRequests = new Set<string>();
  const routeScriptRequests = new Set<string>();
  let observingRoute = false;

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/src/tools/')) {
      if (!observingRoute) homeToolRequests.push(url);
    }

    if (request.resourceType() !== 'script') return;
    if (observingRoute) routeScriptRequests.add(url);
    else homeScriptRequests.add(url);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(homeToolRequests, 'production home route must not eagerly request tool modules').toEqual([]);

  observingRoute = true;
  const response = await page.goto('/en/image-compressor');
  await response?.finished();
  await page.waitForLoadState('networkidle');

  await expect
    .poll(() => [...routeScriptRequests].filter((url) => !homeScriptRequests.has(url)).length, { timeout: 10_000 })
    .toBeGreaterThan(0);
});
